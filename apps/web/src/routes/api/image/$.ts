import { createOpenAI } from "@ai-sdk/openai";
import { createAuth } from "@my-better-t-app/auth";
import { createDb } from "@my-better-t-app/db";
import { imageAsset, imageGeneration } from "@my-better-t-app/db/schema/image";
import { env } from "@my-better-t-app/env/server";
import { createFileRoute } from "@tanstack/react-router";
import { generateText, streamText } from "ai";
import { z } from "zod";

const requestSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  model: z
    .enum(["qwen-image-2.0-pro", "grok-imagine-image", "gemini-image", "sub2api"])
    .default("sub2api"),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]),
  quality: z.enum(["low", "medium", "high"]),
  quantity: z.number().int().min(1).max(4).default(1),
  background: z.enum(["auto", "opaque", "transparent"]),
});

const ideaRequestSchema = z.object({
  action: z.literal("generate-idea"),
});

type ImageSize = z.infer<typeof requestSchema>["size"];
type ImageGenerationInput = z.infer<typeof requestSchema>;
type GeneratedImage = {
  base64: string;
  mediaType: string;
};

const qwenSizeByImageSize: Record<ImageSize, string> = {
  "1024x1024": "2048*2048",
  "1024x1536": "1728*2368",
  "1536x1024": "2368*1728",
};

const aspectRatioByImageSize: Record<ImageSize, string> = {
  "1024x1024": "1:1",
  "1024x1536": "2:3",
  "1536x1024": "3:2",
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

const grokResponseSchema = z.object({
  data: z.array(
    z.object({
      b64_json: z.string().min(1).optional(),
      url: z.string().url().optional(),
      mime_type: z.string().optional(),
    }),
  ),
});

const grokErrorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
});

const geminiErrorSchema = z.object({
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

const geminiResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        images: z
          .array(
            z.object({
              image_url: z.union([
                z.object({
                  url: z.string().min(1),
                }),
                z.string().min(1),
              ]),
            }),
          )
          .optional(),
        content: z.string().nullable().optional(),
      }),
    }),
  ),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const saveGeneration = async ({
  userId,
  input,
  model,
  images,
}: {
  userId: string;
  input: ImageGenerationInput;
  model: string;
  images: GeneratedImage[];
}) => {
  const db = createDb();
  const id = crypto.randomUUID();
  const createdAt = new Date();

  await db.batch([
    db.insert(imageGeneration).values({
      id,
      userId,
      prompt: input.prompt,
      model,
      size: input.size,
      quality: input.quality,
      quantity: images.length,
      background: input.background,
      createdAt,
    }),
    db.insert(imageAsset).values(
      images.map((image, position) => ({
        id: crypto.randomUUID(),
        generationId: id,
        position,
        mediaType: image.mediaType,
        base64: image.base64,
        createdAt,
      })),
    ),
  ]);

  return {
    id,
    prompt: input.prompt,
    model,
    size: input.size,
    quality: input.quality,
    quantity: images.length,
    background: input.background,
    createdAt: createdAt.toISOString(),
    images,
  };
};

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

const getGrokApiBaseUrl = () => {
  const defaultBaseUrl = "https://api.x.ai/v1";
  const baseUrl = (env.GROK2API_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");

  return baseUrl.endsWith("/images/generations")
    ? baseUrl.slice(0, -"/images/generations".length)
    : baseUrl;
};

const getGrokImageEndpoint = () => `${getGrokApiBaseUrl()}/images/generations`;

const getGeminiImageEndpoint = () => {
  const baseUrl = env.GEMINI_BASE_URL.replace(/\/+$/, "");
  return baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;
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

const readGeminiJsonResponse = async (response: Response) => {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(`GEMINI_GATEWAY_EMPTY_RESPONSE:HTTP ${response.status}`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `GEMINI_GATEWAY_INVALID_RESPONSE:HTTP ${response.status}:${text.slice(0, 160)}`,
    );
  }
};

const imageReferenceToGeneratedImage = async (
  imageReference: string,
): Promise<GeneratedImage> => {
  const dataUrlMatch = imageReference.match(
    /^data:([^;,]+);base64,([\s\S]+)$/,
  );

  if (dataUrlMatch) {
    return {
      mediaType: dataUrlMatch[1] || "image/png",
      base64: dataUrlMatch[2] || "",
    };
  }

  const imageResponse = await fetch(imageReference, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!imageResponse.ok) {
    throw new Error(`GEMINI_IMAGE_DOWNLOAD_FAILED:HTTP ${imageResponse.status}`);
  }

  return {
    base64: arrayBufferToBase64(await imageResponse.arrayBuffer()),
    mediaType: imageResponse.headers.get("content-type") || "image/png",
  };
};

const generateWithQwen = async (prompt: string, size: ImageSize, quantity: number) => {
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
        n: quantity,
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
  const imageUrls = result.success
    ? result.data.output.choices
        .flatMap((choice) => choice.message.content)
        .map((content) => content.image)
        .slice(0, quantity)
    : [];

  if (imageUrls.length === 0) {
    throw new Error("DASHSCOPE_IMAGE_MISSING");
  }

  // DashScope image URLs expire after 24 hours, so persist the bytes in the
  // response format already used by the image studio instead of exposing the URL.
  return Promise.all(
    imageUrls.map(async (imageUrl) => {
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
    }),
  );
};

const generateWithGrok = async (prompt: string, size: ImageSize, quantity: number) => {
  if (!env.GROK2API_IDEA_MODEL_API_KEY) {
    throw new Error("GROK2API_IDEA_MODEL_API_KEY_MISSING");
  }

  const response = await fetch(getGrokImageEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROK2API_IDEA_MODEL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.GROK2API_IMAGE_MODEL || "grok-imagine-image",
      prompt,
      response_format: "b64_json",
      n: quantity,
      aspect_ratio: aspectRatioByImageSize[size],
      resolution: "1k",
    }),
    signal: AbortSignal.timeout(180_000),
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const grokError = grokErrorSchema.safeParse(payload);
    const details = grokError.success ? grokError.data.error?.message : undefined;
    throw new Error(`XAI_REQUEST_FAILED:${details || `HTTP ${response.status}`}`);
  }

  const result = grokResponseSchema.safeParse(payload);
  if (
    !result.success ||
    result.data.data.length === 0 ||
    result.data.data.some((image) => !image.b64_json && !image.url)
  ) {
    throw new Error("XAI_IMAGE_MISSING");
  }

  return Promise.all(
    result.data.data.map(async (image) => {
      if (image.b64_json) {
        return {
          base64: image.b64_json,
          mediaType: image.mime_type || "image/jpeg",
        };
      }

      const imageResponse = await fetch(image.url!, {
        signal: AbortSignal.timeout(60_000),
      });

      if (!imageResponse.ok) {
        throw new Error(`XAI_IMAGE_DOWNLOAD_FAILED:HTTP ${imageResponse.status}`);
      }

      return {
        base64: arrayBufferToBase64(await imageResponse.arrayBuffer()),
        mediaType:
          imageResponse.headers.get("content-type") || image.mime_type || "image/jpeg",
      };
    }),
  );
};

const generateWithGemini = async (
  prompt: string,
  size: ImageSize,
  quantity: number,
) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  if (!env.GEMINI_BASE_URL) {
    throw new Error("GEMINI_BASE_URL_MISSING");
  }

  const generateOneImage = async (): Promise<GeneratedImage> => {
    const response = await fetch(getGeminiImageEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${prompt}\n\n生成一张 ${aspectRatioByImageSize[size]} 比例的图片。`,
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(180_000),
    });

    const payload = await readGeminiJsonResponse(response);

    if (!response.ok) {
      const geminiError = geminiErrorSchema.safeParse(payload);
      const details = geminiError.success
        ? geminiError.data.error?.message
        : `HTTP ${response.status}`;
      throw new Error(
        `GEMINI_REQUEST_FAILED:${details || `HTTP ${response.status}`}`,
      );
    }

    const result = geminiResponseSchema.safeParse(payload);
    const message = result.success
      ? result.data.choices[0]?.message
      : undefined;
    const firstImageUrl = message?.images?.[0]?.image_url;
    const imageReference =
      (typeof firstImageUrl === "string" ? firstImageUrl : firstImageUrl?.url) ||
      message?.content?.match(/data:image\/[^;,]+;base64,[A-Za-z0-9+/=\r\n]+/)?.[0];

    if (!imageReference) {
      throw new Error("GEMINI_IMAGE_MISSING");
    }

    return imageReferenceToGeneratedImage(imageReference);
  };

  return Promise.all(
    Array.from({ length: quantity }, () => generateOneImage()),
  );
};

const generateIdeaWithGrok = async () => {
  const sub2api = createOpenAI({
    name: "sub2api-idea",
    apiKey: env.GROK2API_IDEA_MODEL_API_KEY,
    baseURL: env.GROK2API_BASE_URL,
  });

  const result = await generateText({
    model: sub2api.responses(env.GROK2API_IDEA_MODEL || "grok-4.5"),
    system:
      "你是一位富有想象力的视觉创意总监。你的任务是创作适合文本生图模型的中文提示词。只输出最终提示词，不要标题、引号、解释或 Markdown。",
    prompt:
      "随机想一个画面，用不超过40字的简单中文描述主体、场景和风格。只写一句话。",
    temperature: 1.15,
    maxOutputTokens: 100,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(60_000),
  });

  if (!result.text.trim()) {
    throw new Error("XAI_IDEA_MISSING");
  }

  return result.text
    .trim()
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^(?:画面描述|提示词|prompt)\s*[:：]\s*/i, "")
    .replace(/^["“]|["”]$/g, "")
    .trim()
    .slice(0, 40);
};

export const Route = createFileRoute("/api/image/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await createAuth().api.getSession({
          headers: request.headers,
        });

        if (!session) {
          return json({ error: "请先登录后再查看图片库。" }, 401);
        }

        const url = new URL(request.url);
        const offset = Math.max(
          0,
          Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0,
        );
        const pageSize = 10;
        const db = createDb();
        const generations = await db.query.imageGeneration.findMany({
          where: (generation, { eq }) => eq(generation.userId, session.user.id),
          orderBy: (generation, { desc }) => [desc(generation.createdAt)],
          limit: pageSize + 1,
          offset,
          with: {
            images: {
              orderBy: (asset, { asc }) => [asc(asset.position)],
            },
          },
        });
        const hasMore = generations.length > pageSize;

        return json({
          items: generations.slice(0, pageSize).map((generation) => ({
            id: generation.id,
            prompt: generation.prompt,
            model: generation.model,
            size: generation.size,
            quality: generation.quality,
            quantity: generation.quantity,
            background: generation.background,
            createdAt: generation.createdAt.toISOString(),
            images: generation.images.map((image) => ({
              base64: image.base64,
              mediaType: image.mediaType,
            })),
          })),
          hasMore,
          nextOffset: hasMore ? offset + pageSize : null,
        });
      },
      POST: async ({ request }) => {
        const session = await createAuth().api.getSession({
          headers: request.headers,
        });

        if (!session) {
          return json({ error: "请先登录后再生成图片。" }, 401);
        }

        const requestBody: unknown = await request.json();

        if (ideaRequestSchema.safeParse(requestBody).success) {
          try {
            const prompt = await generateIdeaWithGrok();

            return json({
              prompt,
              model: env.GROK2API_IDEA_MODEL || "grok-4.5",
            });
          } catch (error) {
            console.error("Idea generation error:", error);

            const message = error instanceof Error ? error.message : "";
            const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
            let errorMessage = "AI 灵感生成失败，请稍后重试。";

            if (isTimeout) {
              errorMessage = "Grok 4.5 构思超时，请稍后重试。";
            } else if (message === "SUB2API_API_KEY_MISSING") {
              errorMessage = "尚未配置 SUB2API_API_KEY，无法使用 Grok 4.5。";
            } else if (
              message.includes("InvalidApiKey") ||
              message.includes("Authentication") ||
              message.includes("Unauthorized") ||
              message.includes("401")
            ) {
              errorMessage = "Sub2API Key 无效，请检查 SUB2API_API_KEY。";
            } else if (message.includes("No eligible Grok")) {
              errorMessage = "Sub2API 当前没有可用的 Grok 4.5 账号，请检查账号分组。";
            } else if (message === "XAI_IDEA_MISSING") {
              errorMessage = "Grok 4.5 没有返回有效的画面描述，请重试。";
            }

            return json({ error: errorMessage }, isTimeout ? 504 : 502);
          }
        }

        const body = requestSchema.safeParse(requestBody);
        if (!body.success) {
          return json({ error: "请检查提示词和生成参数。" }, 400);
        }

        const { prompt, model, size, quality, quantity, background } = body.data;

        try {
          if (model === "qwen-image-2.0-pro") {
            const images = await generateWithQwen(prompt, size, quantity);
            const generation = await saveGeneration({
              userId: session.user.id,
              input: body.data,
              model,
              images,
            });

            return json({
              ...generation,
              image: generation.images[0],
            });
          }

          if (model === "grok-imagine-image") {
            const images = await generateWithGrok(prompt, size, quantity);
            const generation = await saveGeneration({
              userId: session.user.id,
              input: body.data,
              model: env.GROK2API_IMAGE_MODEL || "grok-imagine-image",
              images,
            });

            return json({
              ...generation,
              image: generation.images[0],
            });
          }

          if (model === "gemini-image") {
            const images = await generateWithGemini(prompt, size, quantity);
            const generation = await saveGeneration({
              userId: session.user.id,
              input: body.data,
              model: env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
              images,
            });

            return json({
              ...generation,
              image: generation.images[0],
            });
          }

          const sub2api = createOpenAI({
            name: "sub2api",
            apiKey: env.SUB2API_API_KEY,
            baseURL: env.SUB2API_BASE_URL,
          });
          const generateOneImage = async () => {
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
              throw new Error("SUB2API_IMAGE_MISSING");
            }

            return {
              base64: imageBase64,
              mediaType: "image/png",
            };
          };

          const images = await Promise.all(
            Array.from({ length: quantity }, () => generateOneImage()),
          );
          const generation = await saveGeneration({
            userId: session.user.id,
            input: body.data,
            model: env.SUB2API_IMAGE_MODEL,
            images,
          });

          return json({
            ...generation,
            image: generation.images[0],
          });
        } catch (error) {
          console.error("Image generation error:", error);

          const message = error instanceof Error ? error.message : "";
          const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
          const isQwen = model === "qwen-image-2.0-pro";
          const isGrok = model === "grok-imagine-image";
          const isGemini = model === "gemini-image";
          let errorMessage = "图片生成失败，请稍后重试。";

          if (isTimeout) {
            errorMessage = "图片生成超时，请稍后重试。";
          } else if (message === "DASHSCOPE_API_KEY_MISSING") {
            errorMessage = "尚未配置 DASHSCOPE_API_KEY，无法使用千问生图。";
          } else if (message === "GROK2API_IDEA_MODEL_API_KEY_MISSING") {
            errorMessage =
              "尚未配置 GROK2API_IDEA_MODEL_API_KEY，无法使用 Grok 生图。";
          } else if (message === "GEMINI_API_KEY_MISSING") {
            errorMessage = "尚未配置 GEMINI_API_KEY，无法使用 Gemini 生图。";
          } else if (message === "GEMINI_BASE_URL_MISSING") {
            errorMessage =
              "尚未配置 GEMINI_BASE_URL，无法连接 Gemini 兼容网关。";
          } else if (
            isGrok &&
            (message.includes("InvalidApiKey") ||
              message.includes("Authentication") ||
              message.includes("Unauthorized") ||
              message.includes("403") ||
              message.includes("401"))
          ) {
            errorMessage = "Grok API Key 无效，请检查 GROK2API_IDEA_MODEL_API_KEY 配置。";
          } else if (
            isGemini &&
            (message.includes("API_KEY_INVALID") ||
              message.includes("PERMISSION_DENIED") ||
              message.includes("Unauthorized") ||
              message.includes("401") ||
              message.includes("403"))
          ) {
            errorMessage =
              "Gemini API Key 无效或没有当前图像模型权限，请检查配置。";
          } else if (
            isQwen &&
            (message.includes("InvalidApiKey") ||
              message.includes("Authentication") ||
              message.includes("401"))
          ) {
            errorMessage = "千问 API Key 无效或与当前地域不匹配，请检查 DashScope 配置。";
          } else if (isGrok) {
            errorMessage = "Grok 图片生成失败，请检查 xAI 配置或稍后重试。";
          } else if (message === "GEMINI_IMAGE_MISSING") {
            errorMessage = "Gemini 已完成请求，但没有返回图片，请重试。";
          } else if (message.includes("GEMINI_GATEWAY_EMPTY_RESPONSE")) {
            errorMessage =
              "Gemini 网关返回了空响应，请检查网关状态或模型账号配置。";
          } else if (message.includes("GEMINI_GATEWAY_INVALID_RESPONSE")) {
            errorMessage = "Gemini 上游返回了无法识别的响应，请检查 Base URL。";
          } else if (isGemini) {
            errorMessage =
              "Gemini 图片生成失败，请检查 BASE_URL、IMAGE_MODEL 或稍后重试。";
          } else if (isQwen) {
            errorMessage = "千问图片生成失败，请检查地域配置或稍后重试。";
          } else if (message === "SUB2API_IMAGE_MISSING") {
            errorMessage =
              "上游完成了请求，但没有返回图片。请确认 Sub2API 已为当前分组启用图像生成模型。";
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
