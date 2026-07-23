import { createOpenAI } from "@ai-sdk/openai";
import { createAuth } from "@my-better-t-app/auth";
import { env } from "@my-better-t-app/env/server";
import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { z } from "zod";

const requestSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  model: z.enum(["qwen-image-2.0-pro", "sub2api"]).default("sub2api"),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]),
  quality: z.enum(["low", "medium", "high"]),
  background: z.enum(["auto", "opaque", "transparent"]),
});

type ImageSize = z.infer<typeof requestSchema>["size"];

const qwenSizeByImageSize: Record<ImageSize, string> = {
  "1024x1024": "2048*2048",
  "1024x1536": "1728*2368",
  "1536x1024": "2368*1728",
};

const qwenResponseSchema = z.object({
  output: z.object({
    choices: z.array(
      z.object({
        message: z.object({
          content: z.array(
            z.object({
              image: z.string().url(),
            }),
          ),
        }),
      }),
    ),
  }),
  request_id: z.string().optional(),
});

const qwenErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  request_id: z.string().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const getDashScopeEndpoint = () => {
  const defaultBaseUrl = "https://dashscope.aliyuncs.com";
  const baseUrl = (env.DASHSCOPE_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");

  if (baseUrl.endsWith("/multimodal-generation/generation")) {
    return baseUrl;
  }

  const apiBaseUrl = baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
  console.log("apiBaseUrl", apiBaseUrl);

  return `${apiBaseUrl}/services/aigc/multimodal-generation/generation`;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
};

const generateWithQwen = async (prompt: string, size: ImageSize) => {
  if (!env.DASHSCOPE_API_KEY) {
    throw new Error("DASHSCOPE_API_KEY_MISSING");
  }

  const response = await fetch(getDashScopeEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen-image-2.0-pro",
      input: {
        messages: [
          {
            role: "user",
            content: [{ text: prompt }],
          },
        ],
      },
      parameters: {
        size: qwenSizeByImageSize[size],
        n: 1,
        prompt_extend: true,
        watermark: false,
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const qwenError = qwenErrorSchema.safeParse(payload);
    const details = qwenError.success
      ? [qwenError.data.code, qwenError.data.message].filter(Boolean).join(": ")
      : `HTTP ${response.status}`;
    throw new Error(`DASHSCOPE_REQUEST_FAILED:${details || `HTTP ${response.status}`}`);
  }

  const result = qwenResponseSchema.safeParse(payload);
  const imageUrl = result.success
    ? result.data.output.choices[0]?.message.content[0]?.image
    : undefined;

  if (!imageUrl) {
    throw new Error("DASHSCOPE_IMAGE_MISSING");
  }

  // DashScope image URLs expire after 24 hours, so persist the bytes in the
  // response format already used by the image studio instead of exposing the URL.
  const imageResponse = await fetch(imageUrl, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!imageResponse.ok) {
    throw new Error(`DASHSCOPE_IMAGE_DOWNLOAD_FAILED:HTTP ${imageResponse.status}`);
  }

  return {
    base64: arrayBufferToBase64(await imageResponse.arrayBuffer()),
    mediaType: imageResponse.headers.get("content-type") || "image/png",
  };
};

export const Route = createFileRoute("/api/image/$")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await createAuth().api.getSession({
          headers: request.headers,
        });

        if (!session) {
          return json({ error: "请先登录后再生成图片。" }, 401);
        }

        const body = requestSchema.safeParse(await request.json());
        if (!body.success) {
          return json({ error: "请检查提示词和生成参数。" }, 400);
        }

        const { prompt, model, size, quality, background } = body.data;

        try {
          if (model === "qwen-image-2.0-pro") {
            const image = await generateWithQwen(prompt, size);

            return json({
              image,
              prompt,
              model,
            });
          }

          const sub2api = createOpenAI({
            name: "sub2api",
            apiKey: env.SUB2API_API_KEY,
            baseURL: env.SUB2API_BASE_URL,
          });
          const imageGeneration = sub2api.tools.imageGeneration({
            model: env.SUB2API_IMAGE_MODEL,
            size,
            quality,
            background,
            outputFormat: "png",
            partialImages: 1,
          });

          // Subridge's synchronous /images/generations endpoint is terminated
          // by its Cloudflare proxy after about 60 seconds. Responses streaming
          // keeps the upstream connection active while the image is rendered.
          const result = streamText({
            model: sub2api.responses(env.SUB2API_MODEL),
            prompt: `Create exactly one image that follows this description:\n\n${prompt}`,
            tools: { image_generation: imageGeneration },
            toolChoice: { type: "tool", toolName: "image_generation" },
            maxRetries: 0,
            abortSignal: AbortSignal.timeout(180_000),
          });

          let imageBase64 = "";

          for await (const part of result.fullStream) {
            if (part.type === "tool-result" && part.toolName === "image_generation") {
              const output = part.output;

              if (
                typeof output === "object" &&
                output !== null &&
                "result" in output &&
                typeof output.result === "string"
              ) {
                imageBase64 = output.result;
              }
            }
          }

          if (!imageBase64) {
            return json(
              {
                error:
                  "上游完成了请求，但没有返回图片。请确认 Sub2API 已为当前分组启用图像生成模型。",
              },
              502,
            );
          }

          return json({
            image: {
              base64: imageBase64,
              mediaType: "image/png",
            },
            prompt,
            model: env.SUB2API_IMAGE_MODEL,
          });
        } catch (error) {
          console.error("Image generation error:", error);

          const message = error instanceof Error ? error.message : "";
          const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
          const isQwen = model === "qwen-image-2.0-pro";
          let errorMessage = "图片生成失败，请稍后重试。";

          if (isTimeout) {
            errorMessage = "图片生成超时，请稍后重试。";
          } else if (message === "DASHSCOPE_API_KEY_MISSING") {
            errorMessage = "尚未配置 DASHSCOPE_API_KEY，无法使用千问生图。";
          } else if (
            message.includes("InvalidApiKey") ||
            message.includes("Authentication") ||
            message.includes("401")
          ) {
            errorMessage = "千问 API Key 无效或与当前地域不匹配，请检查 DashScope 配置。";
          } else if (isQwen) {
            errorMessage = "千问图片生成失败，请检查地域配置或稍后重试。";
          } else if (
            message.includes("502") ||
            message.includes("504") ||
            message.includes("Bad Gateway") ||
            message.includes("Gateway Timeout")
          ) {
            errorMessage = "Sub2API 图像上游暂时不可用，请检查图像模型配置或稍后重试。";
          }

          return json(
            { error: errorMessage },
            isTimeout ? 504 : 502,
          );
        }
      },
    },
  },
});
