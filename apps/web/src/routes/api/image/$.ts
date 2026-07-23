import { createOpenAI } from "@ai-sdk/openai";
import { createAuth } from "@my-better-t-app/auth";
import { env } from "@my-better-t-app/env/server";
import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { z } from "zod";

const requestSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]),
  quality: z.enum(["low", "medium", "high"]),
  background: z.enum(["auto", "opaque", "transparent"]),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

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

        const { prompt, size, quality, background } = body.data;

        try {
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
            if (
              part.type === "tool-result" &&
              part.toolName === "image_generation" &&
              part.output.result
            ) {
              imageBase64 = part.output.result;
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

          return json(
            {
              error: isTimeout
                ? "图片生成超过 3 分钟，请降低质量后重试。"
                : message.includes("502") ||
                    message.includes("504") ||
                    message.includes("Bad Gateway") ||
                    message.includes("Gateway Timeout")
                  ? "Sub2API 图像上游暂时不可用，请检查图像模型配置或稍后重试。"
                  : "图片生成失败，请稍后重试。",
            },
            isTimeout ? 504 : 502,
          );
        }
      },
    },
  },
});
