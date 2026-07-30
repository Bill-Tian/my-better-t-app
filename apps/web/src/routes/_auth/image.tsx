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
  ArrowDownToLineIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DicesIcon,
  ImageIcon,
  ImagePlusIcon,
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
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/image")({
  component: ImageStudio,
});

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";
type ImageQuality = "low" | "medium" | "high";
type ImageModel =
  | "qwen-image-2.0-pro"
  | "gemini-image";
type ImageQuantity = 1 | 2 | 3 | 4;

type GeneratedAsset = {
  id: string;
  mediaType: string;
  base64?: string;
};

const getImageUrl = (asset: GeneratedAsset) =>
  asset.base64
    ? `data:${asset.mediaType};base64,${asset.base64}`
    : `/api/image?assetId=${asset.id}`;

const downloadGeneratedImage = (
  generation: ImageGeneration,
  image: GeneratedAsset,
  index: number,
) => {
  const anchor = document.createElement("a");
  anchor.href = getImageUrl(image);
  anchor.download = `ai-image-${generation.id}-${index + 1}.${image.mediaType.includes("jpeg") ? "jpg" : "png"}`;
  anchor.click();
};

type ReferenceImage = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
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
  { value: "gemini-image", label: "Gemini Image" },
];

const quantityOptions: ImageQuantity[] = [1, 2, 3, 4];
const maxReferenceImages = 3;
const referenceImageMediaTypes = new Set<ReferenceImage["mediaType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxReferenceImageBytes = 10 * 1024 * 1024;

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



function StudioSelect<T extends string>({
  value,
  onValueChange,
  options,
  label,
  triggerLabel,
  icon,
  disabled = false,
  contentClassName = "",
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
  contentClassName?: string;
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
        <span className="max-w-36 truncate">{triggerLabel}</span>
        <ChevronDownIcon className="size-3 text-muted-foreground transition-transform duration-150 group-data-popup-open/select:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={`w-auto min-w-44 rounded-xl border border-border/70 bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl ${contentClassName}`}
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

function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("qwen-image-2.0-pro");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [quality] = useState<ImageQuality>("medium");
  const [quantity, setQuantity] = useState<ImageQuantity>(1);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [generations, setGenerations] = useState<ImageGeneration[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [preview, setPreview] = useState<PreviewSelection | null>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);
  const selectedSize = sizeOptions.find((option) => option.value === size);
  const selectedModel = modelOptions.find((option) => option.value === model);

  const selectReferenceImages = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;

    const availableSlots = maxReferenceImages - referenceImages.length;
    if (availableSlots <= 0) {
      toast.error(`最多添加 ${maxReferenceImages} 张参考图片`);
      return;
    }

    if (selectedFiles.length > availableSlots) {
      toast.info(`最多添加 ${maxReferenceImages} 张参考图片`);
    }

    try {
      const images = await Promise.all(
        selectedFiles.slice(0, availableSlots).map(fileToReferenceImage),
      );
      setReferenceImages((current) => [...current, ...images]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "参考图片读取失败");
    } finally {
      if (referenceImageInputRef.current) {
        referenceImageInputRef.current.value = "";
      }
    }
  };

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
      toast.success("AI 已生成一条新灵感");
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
          referenceImages: referenceImages.map(({ base64, mediaType }) => ({
            base64,
            mediaType,
          })),
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
      setReferenceImages([]);
      toast.success(
        referenceImages.length > 0
          ? data.images.length > 1
            ? `已根据参考图生成并收藏 ${data.images.length} 张图片`
            : "已根据参考图生成并收藏图片"
          : data.images.length > 1
            ? `已生成并收藏 ${data.images.length} 张图片`
            : "图片已生成并收藏",
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
          <input
            ref={referenceImageInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="选择参考图片"
            onChange={(event) => void selectReferenceImages(event.target.files)}
          />

          <div className="flex items-start gap-2 px-2 pt-2">
            <div className="flex shrink-0 gap-1.5">
              {referenceImages.map((referenceImage, index) => (
                <div
                  key={`${referenceImage.base64.slice(0, 24)}-${index}`}
                  className="relative"
                >
                  <img
                    src={`data:${referenceImage.mediaType};base64,${referenceImage.base64}`}
                    alt={`图生图参考 ${index + 1}`}
                    className="size-14 rounded-xl border bg-muted object-cover sm:size-16"
                  />
                  {!isGenerating && (
                    <button
                      type="button"
                      aria-label={`移除第 ${index + 1} 张参考图片`}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      onClick={() =>
                        setReferenceImages((current) =>
                          current.filter((_, imageIndex) => imageIndex !== index),
                        )
                      }
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </div>
              ))}
              {referenceImages.length < maxReferenceImages && (
                <button
                  type="button"
                  aria-label="添加参考图片"
                  className="flex size-14 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/35 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:size-16"
                  disabled={isGenerating || isGeneratingIdea}
                  onClick={() => referenceImageInputRef.current?.click()}
                >
                  <ImagePlusIcon className="size-5" />
                </button>
              )}
            </div>
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
                placeholder={
                  referenceImages.length > 0
                    ? "描述你希望如何修改参考图，例如更换背景、调整风格或增删元素…"
                    : "描述你想创作的画面、光线、构图与风格…"
                }
                className="min-h-20 resize-none border-0 bg-transparent px-0 py-0 text-sm/relaxed shadow-none focus-visible:ring-0"
                disabled={isGenerating || isGeneratingIdea}
              />
            </div>
            <span className="pt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {prompt.length}/2000
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/45 p-1.5">
            <StudioSelect
              value={model}
              onValueChange={setModel}
              options={modelOptions}
              label="生成模型"
              triggerLabel={selectedModel?.label ?? model}
              icon={<BotIcon />}
              disabled={isGenerating}
              contentClassName="min-w-56"
            />

            <span className="h-4 w-px bg-border" aria-hidden="true" />

            <StudioSelect
              value={size}
              onValueChange={setSize}
              options={sizeOptions.map((option) => ({
                value: option.value,
                label: option.label,
                description: option.ratio,
              }))}
              label="画布比例"
              triggerLabel={selectedSize?.ratio ?? size}
              icon={<RatioIcon />}
              disabled={isGenerating}
            />


            <span className="h-4 w-px bg-border" aria-hidden="true" />

            <StudioSelect
              value={String(quantity)}
              onValueChange={(value) =>
                setQuantity(Number(value) as ImageQuantity)
              }
              options={quantityOptions.map((option) => ({
                value: String(option),
                label: `${option} 张`,
              }))}
              label="生成数量"
              triggerLabel={`${quantity} 张`}
              icon={<Layers3Icon />}
              disabled={isGenerating}
            />

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
              AI 生图
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
                  src={getImageUrl(image)}
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
            src={getImageUrl(selection.image)}
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
