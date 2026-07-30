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
  output: z.object({
    task_id: z.string().min(1),
    task_status: z.string(),
  }),
  request_id: z.string().optional(),
});

const pollResponseSchema = z.object({
  request_id: z.string().optional(),
  output: z.object({
    task_id: z.string(),
    task_status: z.string(),
    video_url: z.string().url().optional(),
    code: z.string().optional(),
    message: z.string().optional(),
  }),
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

const getDashScopeApiBaseUrl = () => {
  const defaultBaseUrl = "https://dashscope.aliyuncs.com";
  const baseUrl = (env.DASHSCOPE_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");

  if (baseUrl.endsWith("/api/v1")) {
    return baseUrl;
  }
  return `${baseUrl}/api/v1`;
};

const getDashScopeVideoSynthesisEndpoint = () =>
  `${getDashScopeApiBaseUrl()}/services/aigc/video-generation/video-synthesis`;

const getDashScopeTaskEndpoint = (taskId: string) =>
  `${getDashScopeApiBaseUrl()}/tasks/${encodeURIComponent(taskId)}`;

const referenceImageToDataUrl = (
  image: z.infer<typeof referenceImageSchema>,
) => `data:${image.mediaType};base64,${image.base64}`;

const getDashScopeVideoSize = (
  aspectRatio: z.infer<typeof requestSchema>["aspectRatio"],
  resolution: z.infer<typeof requestSchema>["resolution"],
) => {
  const is720p = resolution === "720p";
  switch (aspectRatio) {
    case "16:9":
      return is720p ? "1280*720" : "960*540";
    case "9:16":
      return is720p ? "720*1280" : "540*960";
    case "1:1":
      return is720p ? "720*720" : "540*540";
    case "4:3":
      return is720p ? "960*720" : "640*480";
    case "3:4":
      return is720p ? "720*960" : "480*640";
    default:
      return "1280*720";
  }
};

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

const syncGeneration = async (
  db: Db,
  generation: VideoGenerationRow,
): Promise<VideoGenerationRow> => {
  if (generation.status !== "pending") return generation;

  try {
    const response = await fetch(getDashScopeTaskEndpoint(generation.requestId), {
      headers: {
        Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
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

    const status = result.data.output.task_status.toUpperCase();
    const updatedAt = new Date();

    if (status === "SUCCEEDED") {
      const videoUrl = result.data.output.video_url;
      const nextValues = videoUrl
        ? {
            status: "completed",
            progress: 100,
            videoUrl,
            error: null,
            updatedAt,
          }
        : {
            status: "failed",
            progress: generation.progress,
            error: "视频生成完成，但上游没有返回可播放地址。",
            updatedAt,
          };

      await db
        .update(videoGeneration)
        .set(nextValues)
        .where(eq(videoGeneration.id, generation.id));

      return { ...generation, ...nextValues };
    }

    if (status === "FAILED" || status === "UNKNOWN") {
      const errorMsg =
        result.data.output.message ||
        result.data.output.code ||
        "视频生成失败，请稍后重试。";
      const nextValues = {
        status: "failed",
        progress: generation.progress,
        error: errorMsg,
        updatedAt,
      };

      await db
        .update(videoGeneration)
        .set(nextValues)
        .where(eq(videoGeneration.id, generation.id));

      return { ...generation, ...nextValues };
    }

    if (status === "RUNNING") {
      const progress = Math.max(generation.progress, 50);
      if (progress !== generation.progress) {
        const nextValues = { progress, updatedAt };
        await db
          .update(videoGeneration)
          .set(nextValues)
          .where(eq(videoGeneration.id, generation.id));
        return { ...generation, ...nextValues };
      }
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

        if (!env.DASHSCOPE_API_KEY) {
          return json(
            {
              error: "尚未配置 DASHSCOPE_API_KEY，无法使用千问万相视频生成。",
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
        const model = "wan2.2-i2v-plus";
        const mode = body.data.referenceImage
          ? "image-to-video"
          : "text-to-video";

        try {
          const response = await fetch(getDashScopeVideoSynthesisEndpoint(), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
              "X-DashScope-Async": "enable",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              input: {
                prompt: body.data.prompt,
                ...(body.data.referenceImage
                  ? {
                      img_url: referenceImageToDataUrl(
                        body.data.referenceImage,
                      ),
                    }
                  : {}),
              },
              parameters: {
                size: getDashScopeVideoSize(
                  body.data.aspectRatio,
                  body.data.resolution,
                ),
                duration: body.data.duration,
              },
            }),
            signal: AbortSignal.timeout(60_000),
          });
          const payload: unknown = await response.json();

          if (!response.ok) {
            const message =
              typeof payload === "object" &&
              payload !== null &&
              "message" in payload &&
              typeof payload.message === "string"
                ? payload.message
                : `HTTP ${response.status}`;
            throw new Error(`DASHSCOPE_VIDEO_REQUEST_FAILED:${message}`);
          }

          const result = startResponseSchema.safeParse(payload);
          if (!result.success) {
            throw new Error("DASHSCOPE_VIDEO_REQUEST_ID_MISSING");
          }

          const createdAt = new Date();
          const generation: VideoGenerationRow = {
            id,
            userId: session.user.id,
            requestId: result.data.output.task_id,
            prompt: body.data.prompt,
            model,
            mode,
            duration: body.data.duration,
            aspectRatio: body.data.aspectRatio,
            resolution: body.data.resolution,
            status: "pending",
            progress: 10,
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
              "DashScope API Key 无效或没有视频模型权限，请检查账号配置。";
          } else if (message.startsWith("DASHSCOPE_VIDEO_REQUEST_FAILED:")) {
            errorMessage = `视频任务创建失败：${message.replace(
              "DASHSCOPE_VIDEO_REQUEST_FAILED:",
              "",
            )}`;
          } else if (message === "DASHSCOPE_VIDEO_REQUEST_ID_MISSING") {
            errorMessage = "DashScope 没有返回有效的视频任务编号，请稍后重试。";
          }

          return json({ error: errorMessage }, isTimeout ? 504 : 502);
        }
      },
    },
  },
});

