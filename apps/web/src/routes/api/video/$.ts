import { createAuth } from "@my-better-t-app/auth";
import { createDb, eq } from "@my-better-t-app/db";
import { videoGeneration } from "@my-better-t-app/db/schema/video";
import { env } from "@my-better-t-app/env/server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const referenceImageSchema = z.object({
  base64: z.string().min(1).max(14_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const requestSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  duration: z.number().int().min(1).max(15),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]),
  resolution: z.enum(["480p", "720p"]),
  referenceImage: referenceImageSchema.optional(),
});

const startResponseSchema = z.object({
  request_id: z.string().min(1),
});

const fileOutputSchema = z
  .object({
    file_id: z.string().optional(),
    public_url: z.string().url().optional(),
  })
  .optional();

const pollResponseSchema = z.object({
  status: z.string(),
  progress: z.number().optional(),
  model: z.string().optional(),
  video: z
    .object({
      url: z.string().url().optional(),
      duration: z.number().optional(),
      respect_moderation: z.boolean().optional(),
      file_output: fileOutputSchema,
    })
    .optional(),
  file_output: fileOutputSchema,
  error: z
    .union([
      z.string(),
      z.object({
        message: z.string().optional(),
      }),
    ])
    .optional(),
});

type VideoGenerationRow = typeof videoGeneration.$inferSelect;
type Db = ReturnType<typeof createDb>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const getGrokApiBaseUrl = () => {
  const defaultBaseUrl = "https://api.x.ai/v1";
  const baseUrl = (env.GROK2API_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");
  const endpointSuffixes = [
    "/images/generations",
    "/images/edits",
    "/videos/generations",
  ];
  const suffix = endpointSuffixes.find((item) => baseUrl.endsWith(item));

  return suffix ? baseUrl.slice(0, -suffix.length) : baseUrl;
};

const getVideoGenerationEndpoint = () =>
  `${getGrokApiBaseUrl()}/videos/generations`;

const getVideoStatusEndpoint = (requestId: string) =>
  `${getGrokApiBaseUrl()}/videos/${encodeURIComponent(requestId)}`;

const referenceImageToDataUrl = (
  image: z.infer<typeof referenceImageSchema>,
) => `data:${image.mediaType};base64,${image.base64}`;

const serializeGeneration = (generation: VideoGenerationRow) => ({
  id: generation.id,
  prompt: generation.prompt,
  model: generation.model,
  mode: generation.mode,
  duration: generation.duration,
  aspectRatio: generation.aspectRatio,
  resolution: generation.resolution,
  status: generation.status,
  progress: generation.progress,
  videoUrl: generation.videoUrl,
  error: generation.error,
  createdAt: generation.createdAt.toISOString(),
  updatedAt: generation.updatedAt.toISOString(),
});

const getPollError = (payload: z.infer<typeof pollResponseSchema>) => {
  if (typeof payload.error === "string") return payload.error;
  return payload.error?.message;
};

const syncGeneration = async (
  db: Db,
  generation: VideoGenerationRow,
): Promise<VideoGenerationRow> => {
  if (generation.status !== "pending") return generation;

  try {
    const response = await fetch(getVideoStatusEndpoint(generation.requestId), {
      headers: {
        Authorization: `Bearer ${env.GROK2API_IDEA_MODEL_API_KEY}`,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      console.error("Video status request failed:", response.status, payload);
      return generation;
    }

    const result = pollResponseSchema.safeParse(payload);
    if (!result.success) {
      console.error("Invalid video status response:", result.error);
      return generation;
    }

    const status = result.data.status.toLowerCase();
    const progress = Math.max(
      0,
      Math.min(100, Math.round(result.data.progress ?? generation.progress)),
    );
    const updatedAt = new Date();

    if (status === "done") {
      const fileOutput =
        result.data.video?.file_output ?? result.data.file_output;
      const videoUrl = fileOutput?.public_url ?? result.data.video?.url;
      const nextValues = videoUrl
        ? {
            status: "completed",
            progress: 100,
            videoUrl,
            fileId: fileOutput?.file_id ?? null,
            error: null,
            updatedAt,
          }
        : {
            status: "failed",
            progress,
            error: "视频生成完成，但上游没有返回可播放地址。",
            updatedAt,
          };

      await db
        .update(videoGeneration)
        .set(nextValues)
        .where(eq(videoGeneration.id, generation.id));

      return { ...generation, ...nextValues };
    }

    if (status === "failed" || status === "expired") {
      const nextValues = {
        status: "failed",
        progress,
        error:
          getPollError(result.data) ||
          (status === "expired"
            ? "视频生成任务已过期，请重新生成。"
            : "视频生成失败，请稍后重试。"),
        updatedAt,
      };

      await db
        .update(videoGeneration)
        .set(nextValues)
        .where(eq(videoGeneration.id, generation.id));

      return { ...generation, ...nextValues };
    }

    if (progress !== generation.progress) {
      const nextValues = { progress, updatedAt };
      await db
        .update(videoGeneration)
        .set(nextValues)
        .where(eq(videoGeneration.id, generation.id));
      return { ...generation, ...nextValues };
    }
  } catch (error) {
    console.error("Video status sync error:", error);
  }

  return generation;
};

export const Route = createFileRoute("/api/video/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await createAuth().api.getSession({
          headers: request.headers,
        });

        if (!session) {
          return json({ error: "请先登录后再查看视频任务。" }, 401);
        }

        const url = new URL(request.url);
        const offset = Math.max(
          0,
          Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0,
        );
        const pageSize = 10;
        const db = createDb();
        const generations = await db.query.videoGeneration.findMany({
          where: (generation, { eq: equals }) =>
            equals(generation.userId, session.user.id),
          orderBy: (generation, { desc }) => [desc(generation.createdAt)],
          limit: pageSize + 1,
          offset,
        });
        const hasMore = generations.length > pageSize;
        const page = generations.slice(0, pageSize);
        const synced = await Promise.all(
          page.map((generation) => syncGeneration(db, generation)),
        );

        return json({
          items: synced.map(serializeGeneration),
          hasMore,
          nextOffset: hasMore ? offset + pageSize : null,
        });
      },
      POST: async ({ request }) => {
        const session = await createAuth().api.getSession({
          headers: request.headers,
        });

        if (!session) {
          return json({ error: "请先登录后再生成视频。" }, 401);
        }

        if (!env.GROK2API_IDEA_MODEL_API_KEY) {
          return json(
            {
              error:
                "尚未配置 GROK2API_IDEA_MODEL_API_KEY，无法使用 Grok 视频生成。",
            },
            503,
          );
        }

        const requestBody: unknown = await request.json();
        const body = requestSchema.safeParse(requestBody);

        if (!body.success) {
          return json({ error: "请检查提示词、视频参数或参考图片。" }, 400);
        }

        const id = crypto.randomUUID();
        const model = "grok-imagine-video";
        const mode = body.data.referenceImage
          ? "image-to-video"
          : "text-to-video";

        try {
          const response = await fetch(getVideoGenerationEndpoint(), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.GROK2API_IDEA_MODEL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              prompt: body.data.prompt,
              duration: body.data.duration,
              aspect_ratio: body.data.aspectRatio,
              resolution: body.data.resolution,
              ...(body.data.referenceImage
                ? {
                    image: {
                      url: referenceImageToDataUrl(body.data.referenceImage),
                    },
                  }
                : {}),
              storage_options: {
                filename: `ai-video-${id}.mp4`,
                public_url: true,
              },
            }),
            signal: AbortSignal.timeout(60_000),
          });
          const payload: unknown = await response.json();

          if (!response.ok) {
            const message =
              typeof payload === "object" &&
              payload !== null &&
              "error" in payload &&
              typeof payload.error === "object" &&
              payload.error !== null &&
              "message" in payload.error &&
              typeof payload.error.message === "string"
                ? payload.error.message
                : `HTTP ${response.status}`;
            throw new Error(`XAI_VIDEO_REQUEST_FAILED:${message}`);
          }

          const result = startResponseSchema.safeParse(payload);
          if (!result.success) {
            throw new Error("XAI_VIDEO_REQUEST_ID_MISSING");
          }

          const createdAt = new Date();
          const generation: VideoGenerationRow = {
            id,
            userId: session.user.id,
            requestId: result.data.request_id,
            prompt: body.data.prompt,
            model,
            mode,
            duration: body.data.duration,
            aspectRatio: body.data.aspectRatio,
            resolution: body.data.resolution,
            status: "pending",
            progress: 0,
            videoUrl: null,
            fileId: null,
            error: null,
            createdAt,
            updatedAt: createdAt,
          };

          await createDb().insert(videoGeneration).values(generation);

          return json(serializeGeneration(generation), 202);
        } catch (error) {
          console.error("Video generation error:", error);

          const message = error instanceof Error ? error.message : "";
          const isTimeout =
            error instanceof DOMException && error.name === "TimeoutError";
          let errorMessage = "视频任务创建失败，请稍后重试。";

          if (isTimeout) {
            errorMessage = "视频任务创建超时，请稍后重试。";
          } else if (
            message.includes("Unauthorized") ||
            message.includes("Authentication") ||
            message.includes("401") ||
            message.includes("403")
          ) {
            errorMessage =
              "Grok API Key 无效或没有视频模型权限，请检查账号配置。";
          } else if (message.startsWith("XAI_VIDEO_REQUEST_FAILED:")) {
            errorMessage = `Grok 视频任务创建失败：${message.replace(
              "XAI_VIDEO_REQUEST_FAILED:",
              "",
            )}`;
          } else if (message === "XAI_VIDEO_REQUEST_ID_MISSING") {
            errorMessage = "Grok 没有返回有效的视频任务编号，请稍后重试。";
          }

          return json({ error: errorMessage }, isTimeout ? 504 : 502);
        }
      },
    },
  },
});
