import { createAuth } from "@my-better-t-app/auth";
import { env } from "@my-better-t-app/env/server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(2000, "最多支持 2000 个字符"),
  voice: z.string().trim().min(1),
  speechRate: z.number().min(0.5).max(2.0).default(1.0),
  volume: z.number().min(0).max(100).default(50),
});

const getDashScopeApiBaseUrl = () => {
  // TTS 生成使用公有模型 cosyvoice-v1，必须请求公共域名，不能请求业务专属域名
  return "https://dashscope.aliyuncs.com/api/v1";
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export const Route = createFileRoute("/api/voice-design/$")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await createAuth().api.getSession({
          headers: request.headers,
        });

        if (!session) {
          return json({ error: "请先登录后再使用 AI 语音。" }, 401);
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
              error: body.error.issues[0]?.message || "请检查输入参数。",
            },
            400,
          );
        }

        if (!env.DASHSCOPE_API_KEY) {
          return json({ error: "尚未配置 DASHSCOPE_API_KEY，无法使用 AI 语音。" }, 503);
        }

        const { text, voice, speechRate, volume } = body.data;

        try {
          const response = await fetch(
            `${getDashScopeApiBaseUrl()}/services/audio/text-to-speech/text-to-speech`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
                "Content-Type": "application/json",
                "X-DashScope-DataInspection": "enable",
              },
              body: JSON.stringify({
                model: "cosyvoice-v1",
                input: {
                  text,
                },
                parameters: {
                  voice,
                  sample_rate: 24000,
                  format: "mp3",
                  speech_rate: speechRate,
                  volume,
                },
              }),
              signal: AbortSignal.timeout(60_000),
            },
          );

          if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
               const errorJson = await response.json() as any;
               errorMsg = errorJson.message || errorJson.code || errorMsg;
            } else {
               errorMsg = await response.text() || errorMsg;
            }
            throw new Error(`DASHSCOPE_REQUEST_FAILED:${errorMsg}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");

          return json({
            audio: {
              base64,
              mediaType: "audio/mpeg",
              sampleRate: 24000,
              format: "mp3",
            },
          });
        } catch (error) {
          console.error("Text-to-speech error:", error);

          const message = error instanceof Error ? error.message : "";
          const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
          let errorMessage = "语音生成失败，请稍后重试。";

          if (isTimeout) {
            errorMessage = "语音生成超时，请稍后重试。";
          } else if (
            message.includes("InvalidApiKey") ||
            message.includes("Authentication") ||
            message.includes("401")
          ) {
            errorMessage = "DashScope API Key 无效。";
          } else if (message.includes("DataInspectionFailed")) {
            errorMessage = "输入的文本未通过内容安全检查，请修改后重试。";
          } else if (message.includes("DASHSCOPE_REQUEST_FAILED:")) {
            errorMessage = `语音生成失败：${message.replace("DASHSCOPE_REQUEST_FAILED:", "").substring(0, 50)}`;
          }

          return json({ error: errorMessage }, isTimeout ? 504 : 502);
        }
      },
    },
  },
});
