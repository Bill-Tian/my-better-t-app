import { createAuth } from "@my-better-t-app/auth";
import { env } from "@my-better-t-app/env/server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const qwenModels = [
  "qwen3-tts-vd-2026-01-26",
  "qwen3-tts-vd-realtime-2026-01-15",
] as const;

const cosyVoiceModels = [
  "cosyvoice-v3.5-plus",
  "cosyvoice-v3.5-flash",
  "cosyvoice-v3-plus",
  "cosyvoice-v3-flash",
] as const;

const targetModelSchema = z.enum([...qwenModels, ...cosyVoiceModels]);
const languageSchema = z.enum(["zh", "en", "de", "it", "pt", "es", "ja", "ko", "fr", "ru"]);

const requestSchema = z
  .object({
    targetModel: targetModelSchema,
    name: z.string().trim().min(1).max(16),
    voicePrompt: z.string().trim().min(8).max(2048),
    previewText: z.string().trim().min(1).max(1024),
    language: languageSchema,
    sampleRate: z.union([z.literal(16000), z.literal(24000), z.literal(48000)]),
    responseFormat: z.enum(["wav", "mp3"]),
  })
  .superRefine((value, context) => {
    const isQwen = qwenModels.includes(value.targetModel as (typeof qwenModels)[number]);

    if (isQwen) {
      if (!/^[a-zA-Z0-9_]+$/.test(value.name)) {
        context.addIssue({
          code: "custom",
          path: ["name"],
          message: "Qwen 音色名称只能包含字母、数字和下划线",
        });
      }
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(value.name) || value.name.length > 10) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "CosyVoice 名称前缀只能包含字母和数字，且不超过 10 个字符",
      });
    }
    if (value.voicePrompt.length > 500) {
      context.addIssue({
        code: "too_big",
        maximum: 500,
        origin: "string",
        path: ["voicePrompt"],
        message: "CosyVoice 声音描述不能超过 500 个字符",
      });
    }
    if (value.previewText.length > 200) {
      context.addIssue({
        code: "too_big",
        maximum: 200,
        origin: "string",
        path: ["previewText"],
        message: "CosyVoice 预览文案不能超过 200 个字符",
      });
    }
    if (value.language !== "zh" && value.language !== "en") {
      context.addIssue({
        code: "custom",
        path: ["language"],
        message: "CosyVoice 声音设计仅支持中文或英文",
      });
    }
  });

const dashScopeResponseSchema = z.object({
  output: z.object({
    preview_audio: z.object({
      data: z.string().min(1),
      sample_rate: z.number(),
      response_format: z.string(),
    }),
    target_model: z.string(),
    voice: z.string().optional(),
    voice_id: z.string().optional(),
  }),
  usage: z
    .object({
      count: z.number(),
    })
    .optional(),
  request_id: z.string().optional(),
});

const dashScopeErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  request_id: z.string().optional(),
});

const mediaTypeByFormat: Record<"wav" | "mp3", string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const getDashScopeApiBaseUrl = () => {
  const defaultBaseUrl = "https://dashscope.aliyuncs.com";
  const baseUrl = (env.DASHSCOPE_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
};

const readDashScopeResponse = async (response: Response) => {
  const text = await response.text();

  if (!text.trim()) {
    const requestId = response.headers.get("x-request-id");
    throw new Error(
      `DASHSCOPE_EMPTY_RESPONSE:HTTP ${response.status}${requestId ? `:${requestId}` : ""}`,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`DASHSCOPE_INVALID_RESPONSE:HTTP ${response.status}:${text.slice(0, 200)}`);
  }
};

export const Route = createFileRoute("/api/voice-design/$")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await createAuth().api.getSession({
          headers: request.headers,
        });

        if (!session) {
          return json({ error: "请先登录后再设计音色。" }, 401);
        }

        let requestBody: unknown;
        try {
          requestBody = await request.json();
        } catch {
          return json({ error: "请求内容不是有效的 JSON。" }, 400);
        }

        const body = requestSchema.safeParse(requestBody);
        if (!body.success) {
          return json(
            {
              error: body.error.issues[0]?.message || "请检查声音描述和预览参数。",
            },
            400,
          );
        }

        if (!env.DASHSCOPE_API_KEY) {
          return json({ error: "尚未配置 DASHSCOPE_API_KEY，无法设计音色。" }, 503);
        }

        const {
          targetModel,
          name,
          voicePrompt,
          previewText,
          language,
          sampleRate,
          responseFormat,
        } = body.data;
        const isQwen = qwenModels.includes(targetModel as (typeof qwenModels)[number]);

        const input = isQwen
          ? {
              action: "create",
              target_model: targetModel,
              preferred_name: name,
              voice_prompt: voicePrompt,
              preview_text: previewText,
              language,
            }
          : {
              action: "create_voice",
              target_model: targetModel,
              prefix: name,
              voice_prompt: voicePrompt,
              preview_text: previewText,
              language_hints: [language],
            };

        try {
          const response = await fetch(
            `${getDashScopeApiBaseUrl()}/services/audio/tts/customization`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: isQwen ? "qwen-voice-design" : "voice-enrollment",
                input,
                parameters: {
                  sample_rate: sampleRate,
                  response_format: responseFormat,
                },
              }),
              signal: AbortSignal.timeout(180_000),
            },
          );

          const payload = await readDashScopeResponse(response);

          if (!response.ok) {
            const upstreamError = dashScopeErrorSchema.safeParse(payload);
            const details = upstreamError.success
              ? [upstreamError.data.code, upstreamError.data.message]
                  .filter(Boolean)
                  .join(": ")
              : `HTTP ${response.status}`;
            throw new Error(`DASHSCOPE_REQUEST_FAILED:${details || `HTTP ${response.status}`}`);
          }

          const result = dashScopeResponseSchema.safeParse(payload);
          if (!result.success) {
            throw new Error("DASHSCOPE_VOICE_RESPONSE_INVALID");
          }

          const voiceId = result.data.output.voice || result.data.output.voice_id;
          if (!voiceId) {
            throw new Error("DASHSCOPE_VOICE_ID_MISSING");
          }

          const format =
            result.data.output.preview_audio.response_format === "mp3" ? "mp3" : responseFormat;

          return json({
            voiceId,
            targetModel: result.data.output.target_model,
            previewAudio: {
              base64: result.data.output.preview_audio.data,
              mediaType: mediaTypeByFormat[format],
              sampleRate: result.data.output.preview_audio.sample_rate,
              format,
            },
            requestId: result.data.request_id,
          });
        } catch (error) {
          console.error("Voice design error:", error);

          const message = error instanceof Error ? error.message : "";
          const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
          let errorMessage = "音色创建失败，请稍后重试。";

          if (isTimeout) {
            errorMessage = "音色创建超过 3 分钟，请稍后重试。";
          } else if (
            message.includes("InvalidApiKey") ||
            message.includes("Authentication") ||
            message.includes("401")
          ) {
            errorMessage = "DashScope API Key 无效或与当前地域不匹配。";
          } else if (message.includes("DASHSCOPE_EMPTY_RESPONSE:HTTP 404")) {
            errorMessage =
              "当前 DashScope 域名不支持所选声音设计模型，请配置对应地域的业务空间专属域名。";
          } else if (message.includes("DataInspectionFailed")) {
            errorMessage = "声音描述或预览文案未通过内容安全检查，请调整后重试。";
          } else if (message.includes("DASHSCOPE_REQUEST_FAILED:")) {
            errorMessage = `音色创建失败：${message.replace("DASHSCOPE_REQUEST_FAILED:", "")}`;
          }

          return json({ error: errorMessage }, isTimeout ? 504 : 502);
        }
      },
    },
  },
});
