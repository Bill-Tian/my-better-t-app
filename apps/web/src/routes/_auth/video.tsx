import { Button } from "@my-better-t-app/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@my-better-t-app/ui/components/dropdown-menu";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import { Textarea } from "@my-better-t-app/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
  BotIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  Clock3Icon,
  DownloadIcon,
  FilmIcon,
  ImageIcon,
  ImagePlusIcon,
  Loader2Icon,
  MonitorPlayIcon,
  RatioIcon,
  RefreshCwIcon,
  SparklesIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/video")({
  component: VideoStudio,
});

type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
type VideoResolution = "480p" | "720p";
type VideoDuration = 5 | 10 | 15;
type VideoMode = "text-to-video" | "image-to-video";
type VideoStatus = "pending" | "completed" | "failed";

type ReferenceImage = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

type VideoGeneration = {
  id: string;
  prompt: string;
  model: string;
  mode: VideoMode;
  duration: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  status: VideoStatus;
  progress: number;
  videoUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type HistoryResponse = {
  items: VideoGeneration[];
  hasMore: boolean;
  nextOffset: number | null;
};

const aspectRatioOptions: Array<{
  value: VideoAspectRatio;
  label: string;
  description: string;
}> = [
  { value: "16:9", label: "横屏", description: "16:9" },
  { value: "9:16", label: "竖屏", description: "9:16" },
  { value: "1:1", label: "方形", description: "1:1" },
  { value: "4:3", label: "经典横屏", description: "4:3" },
  { value: "3:4", label: "经典竖屏", description: "3:4" },
];

const durationOptions: Array<{ value: `${VideoDuration}`; label: string }> = [
  { value: "5", label: "5 秒" },
  { value: "10", label: "10 秒" },
  { value: "15", label: "15 秒" },
];

const resolutionOptions: Array<{
  value: VideoResolution;
  label: string;
  description: string;
}> = [
  { value: "480p", label: "标准", description: "480p" },
  { value: "720p", label: "高清", description: "720p" },
];

const referenceImageMediaTypes = new Set<ReferenceImage["mediaType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxReferenceImageBytes = 10 * 1024 * 1024;

const aspectClass: Record<VideoAspectRatio, string> = {
  "16:9": "aspect-video max-w-4xl",
  "9:16": "aspect-[9/16] max-w-sm",
  "1:1": "aspect-square max-w-2xl",
  "4:3": "aspect-[4/3] max-w-3xl",
  "3:4": "aspect-[3/4] max-w-xl",
};

const formatCreatedAt = (createdAt: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(createdAt));

const fileToReferenceImage = async (file: File): Promise<ReferenceImage> => {
  if (!referenceImageMediaTypes.has(file.type as ReferenceImage["mediaType"])) {
    throw new Error("仅支持 JPG、PNG 或 WebP 图片");
  }

  if (file.size > maxReferenceImageBytes) {
    throw new Error("参考图片不能超过 10 MB");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("图片读取失败"));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex < 0) {
    throw new Error("图片读取失败");
  }

  return {
    base64: dataUrl.slice(commaIndex + 1),
    mediaType: file.type as ReferenceImage["mediaType"],
  };
};

function StudioSelect<T extends string>({
  value,
  onValueChange,
  options,
  label,
  triggerLabel,
  icon,
  disabled = false,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: Array<{
    value: T;
    label: string;
    description?: string;
  }>;
  label: string;
  triggerLabel: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={label}
            disabled={disabled}
            className="group/select rounded-lg border border-transparent bg-background/45 px-2.5 text-foreground shadow-sm hover:border-border hover:bg-background aria-expanded:border-primary/30 aria-expanded:bg-background"
          />
        }
      >
        {icon && (
          <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>
        )}
        <span className="max-w-32 truncate">{triggerLabel}</span>
        <ChevronDownIcon className="size-3 text-muted-foreground transition-transform duration-150 group-data-popup-open/select:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-auto min-w-44 rounded-xl border border-border/70 bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl"
      >
        <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </div>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => onValueChange(nextValue as T)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="my-0.5 min-h-9 rounded-lg px-2.5 py-2 pr-9 transition-colors focus:bg-primary/10 focus:text-primary data-checked:bg-primary/10 data-checked:text-primary"
            >
              <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
                <span className="truncate font-medium">{option.label}</span>
                {option.description && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VideoStudio() {
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(
    null,
  );
  const [aspectRatio, setAspectRatio] =
    useState<VideoAspectRatio>("16:9");
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [resolution, setResolution] =
    useState<VideoResolution>("720p");
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);

  const selectReferenceImage = async (file: File | undefined) => {
    if (!file) return;

    try {
      setReferenceImage(await fileToReferenceImage(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "参考图片读取失败");
    } finally {
      if (referenceImageInputRef.current) {
        referenceImageInputRef.current.value = "";
      }
    }
  };

  const fetchHistory = useCallback(
    async (offset: number, replace: boolean, silent = false) => {
      if (!silent) {
        if (replace) {
          setIsLoadingHistory(true);
          setHistoryError("");
        } else {
          setIsLoadingMore(true);
        }
      }

      try {
        const response = await fetch(`/api/video?offset=${offset}`);
        const data = (await response.json()) as
          | HistoryResponse
          | { error?: string };

        if (!response.ok || !("items" in data)) {
          throw new Error(
            "error" in data ? data.error : "视频任务加载失败",
          );
        }

        setGenerations((current) => {
          if (silent) {
            const updates = new Map(data.items.map((item) => [item.id, item]));
            return current.map((item) => updates.get(item.id) ?? item);
          }

          if (replace) return data.items;

          const knownIds = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...data.items.filter((item) => !knownIds.has(item.id)),
          ];
        });

        if (!silent) {
          setNextOffset(data.nextOffset);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "视频任务加载失败";
        if (!silent) {
          setHistoryError(message);
          if (!replace) toast.error(message);
        }
      } finally {
        if (!silent) {
          setIsLoadingHistory(false);
          setIsLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchHistory(0, true);
  }, [fetchHistory]);

  useEffect(() => {
    if (!generations.some((item) => item.status === "pending")) return;

    const intervalId = window.setInterval(() => {
      void fetchHistory(0, true, true);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [fetchHistory, generations]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();

    if (cleanPrompt.length < 3 || isGenerating) return;

    setIsGenerating(true);

    try {
      const response = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanPrompt,
          duration,
          aspectRatio,
          resolution,
          referenceImage: referenceImage
            ? {
                base64: referenceImage.base64,
                mediaType: referenceImage.mediaType,
              }
            : undefined,
        }),
      });
      const data = (await response.json()) as
        | VideoGeneration
        | { error?: string };

      if (!response.ok || !("id" in data)) {
        throw new Error(
          "error" in data
            ? (data.error ?? "视频任务创建失败")
            : "视频任务创建失败",
        );
      }

      setGenerations((current) => [
        data,
        ...current.filter((item) => item.id !== data.id),
      ]);
      setPrompt("");
      setReferenceImage(null);
      toast.success(
        referenceImage ? "图生视频任务已创建" : "文生视频任务已创建",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "视频任务创建失败，请稍后重试",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="image-library-scrollbar min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top,var(--color-primary)/0.08,transparent_36rem)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-primary uppercase">
              <FilmIcon className="size-4" />
              AI Video Library
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              AI 视频库
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              从文字或一张首帧图片出发，让静态灵感开始流动。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => void fetchHistory(0, true)}
            disabled={isLoadingHistory}
          >
            <RefreshCwIcon
              className={isLoadingHistory ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">刷新任务</span>
          </Button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="sticky top-0 z-20 rounded-2xl border border-border/80 bg-background/90 p-2 shadow-[0_18px_60px_-32px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <input
            ref={referenceImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="选择视频首帧图片"
            onChange={(event) =>
              void selectReferenceImage(event.target.files?.[0])
            }
          />

          <div className="flex items-start gap-2 px-2 pt-2">
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label={
                  referenceImage ? "更换视频首帧" : "添加视频首帧"
                }
                className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/35 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                disabled={isGenerating}
                onClick={() => referenceImageInputRef.current?.click()}
              >
                {referenceImage ? (
                  <img
                    src={`data:${referenceImage.mediaType};base64,${referenceImage.base64}`}
                    alt="图生视频首帧"
                    className="size-full object-cover"
                  />
                ) : (
                  <ImagePlusIcon className="size-5" />
                )}
              </button>
              {referenceImage && !isGenerating && (
                <button
                  type="button"
                  aria-label="移除视频首帧"
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  onClick={() => setReferenceImage(null)}
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </div>

            <SparklesIcon className="mt-1 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <label htmlFor="video-prompt" className="sr-only">
                视频描述
              </label>
              <Textarea
                id="video-prompt"
                value={prompt}
                onChange={(event) =>
                  setPrompt(event.target.value.slice(0, 2000))
                }
                onKeyDown={(event) => {
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key === "Enter"
                  ) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  referenceImage
                    ? "描述首帧接下来如何运动，包括主体动作、镜头运动和氛围变化…"
                    : "描述视频主体、动作、镜头运动、光线与氛围…"
                }
                className="min-h-20 resize-none border-0 bg-transparent px-0 py-0 text-sm/relaxed shadow-none focus-visible:ring-0"
                disabled={isGenerating}
              />
            </div>
            <span className="pt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {prompt.length}/2000
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/45 p-1.5">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/8 px-2.5 text-xs font-medium text-primary">
              {referenceImage ? (
                <>
                  <ImageIcon className="size-3.5" />
                  图生视频
                </>
              ) : (
                <>
                  <VideoIcon className="size-3.5" />
                  文生视频
                </>
              )}
            </span>

            <span className="h-4 w-px bg-border" aria-hidden="true" />

            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs">
              <BotIcon className="size-3.5 text-muted-foreground" />
              Grok Imagine Video
            </span>

            <StudioSelect
              value={aspectRatio}
              onValueChange={setAspectRatio}
              options={aspectRatioOptions}
              label="画面比例"
              triggerLabel={aspectRatio}
              icon={<RatioIcon />}
              disabled={isGenerating}
            />

            <StudioSelect
              value={String(duration) as `${VideoDuration}`}
              onValueChange={(value) =>
                setDuration(Number(value) as VideoDuration)
              }
              options={durationOptions}
              label="视频时长"
              triggerLabel={`${duration} 秒`}
              icon={<Clock3Icon />}
              disabled={isGenerating}
            />

            <StudioSelect
              value={resolution}
              onValueChange={setResolution}
              options={resolutionOptions}
              label="清晰度"
              triggerLabel={resolution}
              icon={<MonitorPlayIcon />}
              disabled={isGenerating}
            />

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                ⌘ Enter
              </span>
              <Button
                type="submit"
                className="rounded-lg px-4"
                disabled={isGenerating || prompt.trim().length < 3}
              >
                {isGenerating ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    创建中
                  </>
                ) : (
                  <>
                    <FilmIcon />
                    生成视频
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        <section className="mt-8" aria-label="视频生成历史">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-medium">生成历史</h2>
            {!isLoadingHistory && generations.length > 0 && (
              <span className="text-xs text-muted-foreground">
                已加载 {generations.length} 个任务
              </span>
            )}
          </div>

          {isLoadingHistory ? (
            <div className="space-y-7 py-6">
              <VideoHistorySkeleton />
              <VideoHistorySkeleton />
            </div>
          ) : historyError && generations.length === 0 ? (
            <div className="my-6 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
              <CircleAlertIcon className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                视频任务暂时无法加载
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {historyError}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 rounded-full"
                onClick={() => void fetchHistory(0, true)}
              >
                重新加载
              </Button>
            </div>
          ) : generations.length === 0 ? (
            <div className="my-6 rounded-2xl border border-dashed bg-muted/30 px-6 py-14 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-background shadow-sm">
                <FilmIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium">
                你的视频库还是空的
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                创建第一个文生视频或图生视频任务吧。
              </p>
            </div>
          ) : (
            <div>
              {generations.map((generation) => (
                <VideoGenerationCard
                  key={generation.id}
                  generation={generation}
                />
              ))}
            </div>
          )}

          {nextOffset !== null && !isLoadingHistory && (
            <div className="flex justify-center py-7">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={isLoadingMore}
                onClick={() => void fetchHistory(nextOffset, false)}
              >
                {isLoadingMore && <Loader2Icon className="animate-spin" />}
                {isLoadingMore ? "加载中" : "加载更早任务"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function VideoGenerationCard({
  generation,
}: {
  generation: VideoGeneration;
}) {
  return (
    <article className="border-b border-border/70 py-7 first:pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-medium leading-relaxed sm:text-lg">
            {generation.prompt}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-medium text-primary">
              {generation.mode === "image-to-video"
                ? "图生视频"
                : "文生视频"}
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              Grok Imagine Video
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              {generation.aspectRatio} · {generation.resolution} ·{" "}
              {generation.duration} 秒
            </span>
            <span className="rounded-md bg-muted px-2 py-1 tabular-nums">
              {formatCreatedAt(generation.createdAt)}
            </span>
          </div>
        </div>

        {generation.status === "pending" && (
          <span className="mt-1 flex shrink-0 items-center gap-1.5 text-xs text-primary">
            <Loader2Icon className="size-3.5 animate-spin" />
            生成中
          </span>
        )}
      </div>

      {generation.status === "pending" ? (
        <div
          className={`${aspectClass[generation.aspectRatio]} relative mt-5 w-full overflow-hidden rounded-2xl border bg-muted/40`}
        >
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full border border-primary/15 bg-background/70 text-primary shadow-lg backdrop-blur">
              <FilmIcon className="size-5" />
            </span>
            <p className="mt-4 text-sm font-medium">正在生成视频</p>
            <p className="mt-1 text-xs text-muted-foreground">
              这通常需要几分钟，你可以离开页面后再回来。
            </p>
            <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-background/70">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: `${Math.max(4, generation.progress)}%`,
                }}
              />
            </div>
            <span className="mt-2 text-[10px] tabular-nums text-muted-foreground">
              {generation.progress > 0
                ? `${generation.progress}%`
                : "等待模型开始渲染"}
            </span>
          </div>
        </div>
      ) : generation.status === "completed" && generation.videoUrl ? (
        <div
          className={`${aspectClass[generation.aspectRatio]} relative mt-5 w-full overflow-hidden rounded-2xl border bg-black shadow-lg`}
        >
          <video
            src={generation.videoUrl}
            controls
            playsInline
            preload="metadata"
            className="size-full object-contain"
          >
            <track kind="captions" />
          </video>
          <a
            href={generation.videoUrl}
            download={`ai-video-${generation.id}.mp4`}
            target="_blank"
            rel="noreferrer"
            className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur transition hover:bg-black/75"
            aria-label="下载视频"
          >
            <DownloadIcon className="size-4" />
          </a>
        </div>
      ) : (
        <div className="mt-5 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-destructive/25 bg-destructive/5 px-6 text-center">
          <div>
            <CircleAlertIcon className="mx-auto size-6 text-destructive" />
            <p className="mt-3 text-sm font-medium">视频生成失败</p>
            <p className="mt-1 max-w-lg text-xs text-muted-foreground">
              {generation.error || "请调整提示词或参数后重新尝试。"}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

function VideoHistorySkeleton() {
  return (
    <div className="border-b border-border/70 py-7">
      <Skeleton className="h-5 w-2/3" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-6 w-32 rounded-md" />
      </div>
      <Skeleton className="mt-5 aspect-video w-full max-w-3xl rounded-2xl" />
    </div>
  );
}
