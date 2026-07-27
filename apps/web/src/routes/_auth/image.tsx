import { Button } from "@my-better-t-app/ui/components/button";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import { Textarea } from "@my-better-t-app/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLineIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DicesIcon,
  ImageIcon,
  ImagesIcon,
  Layers3Icon,
  Loader2Icon,
  Maximize2Icon,
  RatioIcon,
  RefreshCwIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/image")({
  component: ImageStudio,
});

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";
type ImageQuality = "low" | "medium" | "high";
type ImageModel = "qwen-image-2.0-pro" | "grok-imagine-image" | "sub2api";
type ImageQuantity = 1 | 2 | 3 | 4;

type GeneratedAsset = {
  base64: string;
  mediaType: string;
};

type ImageGeneration = {
  id: string;
  prompt: string;
  model: string;
  size: ImageSize;
  quality: ImageQuality;
  quantity: number;
  background: string;
  createdAt: string;
  images: GeneratedAsset[];
};

type HistoryResponse = {
  items: ImageGeneration[];
  hasMore: boolean;
  nextOffset: number | null;
};

type PreviewSelection = {
  generation: ImageGeneration;
  image: GeneratedAsset;
  index: number;
};

const sizeOptions: Array<{ value: ImageSize; label: string; ratio: string }> = [
  { value: "1024x1024", label: "方形", ratio: "1:1" },
  { value: "1024x1536", label: "竖版", ratio: "2:3" },
  { value: "1536x1024", label: "横版", ratio: "3:2" },
];

const qualityOptions: Array<{ value: ImageQuality; label: string }> = [
  { value: "low", label: "快速" },
  { value: "medium", label: "标准" },
  { value: "high", label: "精细" },
];

const modelOptions: Array<{ value: ImageModel; label: string }> = [
  { value: "qwen-image-2.0-pro", label: "Qwen-image-2.0" },
  { value: "grok-imagine-image", label: "Grok-imagine-image" },
  { value: "sub2api", label: "gpt-image-2" },
];

const quantityOptions: ImageQuantity[] = [1, 2, 3, 4];

const modelLabel = (model: string) =>
  modelOptions.find((option) => option.value === model)?.label ?? model;

const formatCreatedAt = (createdAt: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(createdAt));

const imageAspectClass: Record<ImageSize, string> = {
  "1024x1024": "aspect-square",
  "1024x1536": "aspect-[2/3]",
  "1536x1024": "aspect-[3/2]",
};

const downloadGeneratedImage = (
  generation: ImageGeneration,
  image: GeneratedAsset,
  index: number,
) => {
  const anchor = document.createElement("a");
  anchor.href = `data:${image.mediaType};base64,${image.base64}`;
  anchor.download = `ai-image-${generation.id}-${index + 1}.${image.mediaType.includes("jpeg") ? "jpg" : "png"}`;
  anchor.click();
};

function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("grok-imagine-image");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [quantity, setQuantity] = useState<ImageQuantity>(1);
  const [generations, setGenerations] = useState<ImageGeneration[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [preview, setPreview] = useState<PreviewSelection | null>(null);
  const selectedSize = sizeOptions.find((option) => option.value === size);
  const selectedModel = modelOptions.find((option) => option.value === model);

  const fetchHistory = useCallback(async (offset: number, replace: boolean) => {
    if (replace) {
      setIsLoadingHistory(true);
      setHistoryError("");
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await fetch(`/api/image?offset=${offset}`);
      const data = (await response.json()) as HistoryResponse | { error?: string };

      if (!response.ok || !("items" in data)) {
        throw new Error("error" in data ? data.error : "图片库加载失败");
      }

      setGenerations((current) => {
        if (replace) return data.items;

        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...data.items.filter((item) => !knownIds.has(item.id))];
      });
      setNextOffset(data.nextOffset);
    } catch (error) {
      const message = error instanceof Error ? error.message : "图片库加载失败";
      setHistoryError(message);
      if (!replace) toast.error(message);
    } finally {
      setIsLoadingHistory(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory(0, true);
  }, [fetchHistory]);

  const generateIdea = async () => {
    if (isGenerating || isGeneratingIdea) return;

    setIsGeneratingIdea(true);

    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-idea" }),
      });
      const data = (await response.json()) as { prompt?: string; error?: string };

      if (!response.ok || !data.prompt) {
        throw new Error(data.error || "AI 灵感生成失败");
      }

      setPrompt(data.prompt);
      toast.success("Grok 4.5 已生成一条新灵感");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 灵感生成失败，请稍后重试");
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();

    if (cleanPrompt.length < 3 || isGenerating) return;

    setIsGenerating(true);

    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanPrompt,
          model,
          size,
          quality,
          quantity,
          background: "auto",
        }),
      });
      const data = (await response.json()) as ImageGeneration | { error?: string };

      if (!response.ok || !("id" in data) || !data.images?.length) {
        throw new Error("error" in data ? data.error : "图片生成失败");
      }

      setGenerations((current) => [
        data,
        ...current.filter((item) => item.id !== data.id),
      ]);
      setPrompt("");
      toast.success(
        data.images.length > 1 ? `已生成并收藏 ${data.images.length} 张图片` : "图片已生成并收藏",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片生成失败，请稍后重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const pendingGeneration = useMemo<ImageGeneration | null>(() => {
    if (!isGenerating) return null;

    return {
      id: "pending",
      prompt: prompt.trim(),
      model,
      size,
      quality,
      quantity,
      background: "auto",
      createdAt: new Date().toISOString(),
      images: [],
    };
  }, [isGenerating, model, prompt, quality, quantity, size]);

  return (
    <main
      className={`image-library-scrollbar min-h-0 bg-[radial-gradient(circle_at_top,var(--color-primary)/0.08,transparent_36rem)] ${
        preview ? "overflow-hidden" : "overflow-y-auto"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-primary uppercase">
              <ImagesIcon className="size-4" />
              AI Image Library
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI 图片库</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              每次创作都会保存为一个任务，随时回来查看与下载。
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
            <RefreshCwIcon className={isLoadingHistory ? "animate-spin" : ""} />
            <span className="hidden sm:inline">刷新图库</span>
          </Button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="sticky top-0 z-20 rounded-2xl border border-border/80 bg-background/90 p-2 shadow-[0_18px_60px_-32px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <div className="flex items-start gap-2 px-2 pt-2">
            <SparklesIcon className="mt-1 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <label htmlFor="image-prompt" className="sr-only">
                画面描述
              </label>
              <Textarea
                id="image-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value.slice(0, 2000))}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="描述你想创作的画面、光线、构图与风格…"
                className="min-h-20 resize-none border-0 bg-transparent px-0 py-0 text-sm/relaxed shadow-none focus-visible:ring-0"
                disabled={isGenerating || isGeneratingIdea}
              />
            </div>
            <span className="pt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {prompt.length}/2000
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/45 p-1.5">
            <label className="relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition hover:bg-background">
              <BotIcon className="size-3.5 text-muted-foreground" />
              <span className="max-w-36 truncate">{selectedModel?.label}</span>
              <ChevronDownIcon className="size-3 text-muted-foreground" />
              <select
                value={model}
                onChange={(event) => setModel(event.target.value as ImageModel)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="生成模型"
                disabled={isGenerating}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <span className="h-4 w-px bg-border" aria-hidden="true" />

            <label className="relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition hover:bg-background">
              <RatioIcon className="size-3.5 text-muted-foreground" />
              <span>{selectedSize?.ratio}</span>
              <ChevronDownIcon className="size-3 text-muted-foreground" />
              <select
                value={size}
                onChange={(event) => setSize(event.target.value as ImageSize)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="画布比例"
                disabled={isGenerating}
              >
                {sizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} · {option.ratio}
                  </option>
                ))}
              </select>
            </label>

            {model === "sub2api" && (
              <>
                <span className="h-4 w-px bg-border" aria-hidden="true" />
                <label className="relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition hover:bg-background">
                  <span>{qualityOptions.find((option) => option.value === quality)?.label}质量</span>
                  <ChevronDownIcon className="size-3 text-muted-foreground" />
                  <select
                    value={quality}
                    onChange={(event) => setQuality(event.target.value as ImageQuality)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="生成质量"
                    disabled={isGenerating}
                  >
                    {qualityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <span className="h-4 w-px bg-border" aria-hidden="true" />

            <label className="relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition hover:bg-background">
              <Layers3Icon className="size-3.5 text-muted-foreground" />
              <span>{quantity} 张</span>
              <ChevronDownIcon className="size-3 text-muted-foreground" />
              <select
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value) as ImageQuantity)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="生成数量"
                disabled={isGenerating}
              >
                {quantityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} 张
                  </option>
                ))}
              </select>
            </label>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={generateIdea}
              className="rounded-lg"
              disabled={isGenerating || isGeneratingIdea}
            >
              {isGeneratingIdea ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  构思中
                </>
              ) : (
                <>
                  <DicesIcon />
                  AI 灵感
                </>
              )}
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                ⌘ Enter
              </span>
              <Button
                type="submit"
                className="rounded-lg px-4"
                disabled={isGenerating || isGeneratingIdea || prompt.trim().length < 3}
              >
                {isGenerating ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    绘制中
                  </>
                ) : (
                  <>
                    <SparklesIcon />
                    生成图片
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        <section className="mt-8" aria-label="生成历史">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-medium">生成历史</h2>
            {!isLoadingHistory && generations.length > 0 && (
              <span className="text-xs text-muted-foreground">
                已加载 {generations.length} 个任务
              </span>
            )}
          </div>

          {pendingGeneration && <GenerationCard generation={pendingGeneration} pending />}

          {isLoadingHistory ? (
            <div className="space-y-6 py-6">
              <HistorySkeleton />
              <HistorySkeleton />
            </div>
          ) : historyError && generations.length === 0 ? (
            <div className="my-6 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
              <ImageIcon className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">图片库暂时无法加载</p>
              <p className="mt-1 text-xs text-muted-foreground">{historyError}</p>
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
          ) : generations.length === 0 && !pendingGeneration ? (
            <div className="my-6 rounded-2xl border border-dashed bg-muted/30 px-6 py-14 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-background shadow-sm">
                <ImagesIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium">你的图片库还是空的</p>
              <p className="mt-1 text-xs text-muted-foreground">
                完成第一次创作后，任务和图片会自动收藏在这里。
              </p>
            </div>
          ) : (
            <div>
              {generations.map((generation) => (
                <GenerationCard
                  key={generation.id}
                  generation={generation}
                  onPreview={(image, index) =>
                    setPreview({ generation, image, index })
                  }
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
      {preview && (
        <ImagePreview
          selection={preview}
          onClose={() => setPreview(null)}
          onChangeIndex={(index) => {
            const image = preview.generation.images[index];
            if (image) {
              setPreview({ ...preview, image, index });
            }
          }}
        />
      )}
    </main>
  );
}

function GenerationCard({
  generation,
  pending = false,
  onPreview,
}: {
  generation: ImageGeneration;
  pending?: boolean;
  onPreview?: (image: GeneratedAsset, index: number) => void;
}) {
  const sizeMeta = sizeOptions.find((option) => option.value === generation.size);
  const qualityMeta = qualityOptions.find(
    (option) => option.value === generation.quality,
  );

  return (
    <article className="border-b border-border/70 py-7 first:pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-medium leading-relaxed sm:text-lg">
            {generation.prompt}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-medium text-primary">
              文生图
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              {modelLabel(generation.model)}
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              {sizeMeta?.ratio} · {qualityMeta?.label ?? generation.quality} · x
              {generation.quantity}
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              {generation.size.replace("x", "×")}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 tabular-nums">
              {pending ? "生成中…" : formatCreatedAt(generation.createdAt)}
            </span>
          </div>
        </div>
        {pending && (
          <span className="mt-1 flex shrink-0 items-center gap-1.5 text-xs text-primary">
            <Loader2Icon className="size-3.5 animate-spin" />
            绘制中
          </span>
        )}
      </div>

      {pending ? (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: generation.quantity }, (_, index) => (
            <div
              key={index}
              className={`${imageAspectClass[generation.size]} relative overflow-hidden rounded-xl border bg-muted/40`}
            >
              <Skeleton className="absolute inset-0 rounded-none" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2Icon className="size-5 animate-spin" />
                <span className="mt-2 text-xs">灵感正在逐渐清晰</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {generation.images.map((image, index) => (
            <figure
              key={`${generation.id}-${index}`}
              className={`${imageAspectClass[generation.size]} group relative overflow-hidden rounded-xl bg-muted`}
            >
              <button
                type="button"
                className="h-full w-full cursor-zoom-in text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                onClick={() => onPreview?.(image, index)}
                aria-label={`预览第 ${index + 1} 张图片`}
              >
                <img
                  src={`data:${image.mediaType};base64,${image.base64}`}
                  alt={`${generation.prompt}，第 ${index + 1} 张`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
                />
                <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg bg-black/55 text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <Maximize2Icon className="size-4" />
                </span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute bottom-3 left-3 z-10 rounded-xl bg-background/80 shadow-lg backdrop-blur"
                onClick={() => downloadGeneratedImage(generation, image, index)}
                aria-label={`下载第 ${index + 1} 张图片`}
              >
                <ArrowDownToLineIcon />
              </Button>
            </figure>
          ))}
        </div>
      )}
    </article>
  );
}

function ImagePreview({
  selection,
  onClose,
  onChangeIndex,
}: {
  selection: PreviewSelection;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}) {
  const imageCount = selection.generation.images.length;
  const changeImage = useCallback(
    (direction: -1 | 1) => {
      if (imageCount < 2) return;

      onChangeIndex(
        (selection.index + direction + imageCount) % imageCount,
      );
    },
    [imageCount, onChangeIndex, selection.index],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        changeImage(-1);
      } else if (event.key === "ArrowRight") {
        changeImage(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeImage, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full max-w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {selection.generation.prompt}
            </p>
            <p className="mt-0.5 text-xs text-white/55">
              第 {selection.index + 1}
              {imageCount > 1 ? ` / ${imageCount}` : ""} 张 ·{" "}
              {selection.generation.size.replace("x", "×")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="rounded-xl bg-white/10 text-white hover:bg-white/20"
              onClick={() =>
                downloadGeneratedImage(
                  selection.generation,
                  selection.image,
                  selection.index,
                )
              }
              aria-label="下载当前图片"
            >
              <ArrowDownToLineIcon />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="rounded-xl bg-white/10 text-white hover:bg-white/20"
              onClick={onClose}
              aria-label="关闭预览"
              autoFocus
            >
              <XIcon />
            </Button>
          </div>
        </div>
        <div className="relative flex min-h-0 items-center justify-center p-2">
          <img
            src={`data:${selection.image.mediaType};base64,${selection.image.base64}`}
            alt={`${selection.generation.prompt}，第 ${selection.index + 1} 张预览`}
            className="max-h-[calc(100svh-8rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-w-[calc(100vw-4rem)]"
          />
          {imageCount > 1 && (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/55 text-white shadow-xl backdrop-blur hover:bg-black/75 sm:left-5"
                onClick={() => changeImage(-1)}
                aria-label="预览上一张图片"
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/55 text-white shadow-xl backdrop-blur hover:bg-black/75 sm:right-5"
                onClick={() => changeImage(1)}
                aria-label="预览下一张图片"
              >
                <ChevronRightIcon />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="border-b border-border/70 pb-7">
      <Skeleton className="h-5 w-2/5" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <Skeleton className="aspect-square rounded-xl" />
        <Skeleton className="aspect-square rounded-xl" />
        <Skeleton className="hidden aspect-square rounded-xl md:block" />
        <Skeleton className="hidden aspect-square rounded-xl lg:block" />
      </div>
    </div>
  );
}
