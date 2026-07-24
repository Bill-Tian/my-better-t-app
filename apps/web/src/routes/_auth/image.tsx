import { Button } from "@my-better-t-app/ui/components/button";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import { Textarea } from "@my-better-t-app/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLineIcon,
  BotIcon,
  ChevronDownIcon,
  DicesIcon,
  ImageIcon,
  Layers3Icon,
  Loader2Icon,
  RatioIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
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

type GenerationResponse = {
  images?: GeneratedAsset[];
  image?: GeneratedAsset;
  prompt: string;
  model: string;
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
  { value: "qwen-image-2.0-pro", label: "千问 Image 2.0 Pro" },
  { value: "grok-imagine-image", label: "Grok Imagine · Sub2API" },
  { value: "sub2api", label: "GPT Image · Sub2API" },
];

const quantityOptions: ImageQuantity[] = [1, 2, 3, 4];

function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("qwen-image-2.0-pro");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [quantity, setQuantity] = useState<ImageQuantity>(1);
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);

  const images = useMemo(() => {
    if (!result) return [];
    return result.images ?? (result.image ? [result.image] : []);
  }, [result]);

  const selectedImageUrl = useMemo(() => {
    const image = images[selectedImage];
    return image ? `data:${image.mediaType};base64,${image.base64}` : "";
  }, [images, selectedImage]);

  const selectedSize = sizeOptions.find((option) => option.value === size);
  const selectedModel = modelOptions.find((option) => option.value === model);

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
    setResult(null);
    setSelectedImage(0);

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
      const data = (await response.json()) as GenerationResponse | { error?: string };

      if (
        !response.ok ||
        !("prompt" in data) ||
        (!data.images?.length && !data.image)
      ) {
        throw new Error("error" in data ? data.error : "图片生成失败");
      }

      setResult(data);
      toast.success(data.images && data.images.length > 1 ? `已生成 ${data.images.length} 张图片` : "图片已生成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片生成失败，请稍后重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!selectedImageUrl) return;

    const anchor = document.createElement("a");
    anchor.href = selectedImageUrl;
    anchor.download = `ai-image-${selectedImage + 1}-${Date.now()}.png`;
    anchor.click();
  };

  return (
    <main className="relative grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[radial-gradient(circle_at_top,var(--color-primary)/0.08,transparent_32rem)]">
      <section className="relative flex min-h-0 flex-col px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="pointer-events-none absolute top-6 left-6 z-10 flex items-center gap-2.5 rounded-full border border-white/10 bg-background/70 px-3 py-2 shadow-lg backdrop-blur-xl sm:top-8 sm:left-8">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <WandSparklesIcon className="size-3.5" />
          </span>
          <span>
            <span className="block text-[9px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              AI Image Studio
            </span>
            <span className="block text-xs font-medium">生成画布</span>
          </span>
        </div>

        {images.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadImage}
            className="absolute top-6 right-6 z-10 rounded-full bg-background/70 shadow-lg backdrop-blur-xl sm:top-8 sm:right-8"
          >
            <ArrowDownToLineIcon />
            下载{images.length > 1 ? `第 ${selectedImage + 1} 张` : " PNG"}
          </Button>
        )}

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(45deg,var(--color-muted)_25%,transparent_25%,transparent_75%,var(--color-muted)_75%),linear-gradient(45deg,var(--color-muted)_25%,transparent_25%,transparent_75%,var(--color-muted)_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px] shadow-inner">
          {isGenerating ? (
            <div className="absolute inset-0 bg-background/90 p-4 backdrop-blur-sm sm:p-8">
              <Skeleton className="h-full w-full rounded-xl" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="flex size-14 items-center justify-center rounded-full border bg-background shadow-xl">
                  <Loader2Icon className="size-5 animate-spin" />
                </div>
                <p className="mt-4 text-sm font-medium">
                  正在绘制 {quantity > 1 ? `${quantity} 张画面` : "画面"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">灵感正在逐渐清晰</p>
              </div>
            </div>
          ) : images.length > 0 ? (
            <div
              className={`grid h-full w-full gap-2 p-2 ${
                images.length === 1
                  ? "grid-cols-1"
                  : images.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-2 grid-rows-2"
              }`}
            >
              {images.map((image, index) => (
                <button
                  key={`${result?.model}-${index}`}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  aria-label={`选择第 ${index + 1} 张图片`}
                  aria-pressed={selectedImage === index}
                  className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-xl bg-black/10 outline-none ring-primary transition aria-pressed:ring-2 focus-visible:ring-2"
                >
                  <img
                    src={`data:${image.mediaType};base64,${image.base64}`}
                    alt={`${result?.prompt ?? prompt}，第 ${index + 1} 张`}
                    className="h-full w-full object-contain"
                  />
                  {images.length > 1 && (
                    <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur">
                      {index + 1}/{images.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-sm px-8 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full border bg-background/90 shadow-xl">
                <ImageIcon className="size-6 text-muted-foreground" />
              </div>
              <h1 className="mt-5 text-lg font-semibold tracking-tight">把想法变成画面</h1>
              <p className="mt-2 text-xs/relaxed text-muted-foreground">
                在下方描述你想看到的内容，整片画布都为创作留白。
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="relative z-20 px-3 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-5xl rounded-2xl border border-border/80 bg-background/90 p-2 shadow-[0_-16px_50px_-24px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
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
                className="min-h-18 resize-none border-0 bg-transparent px-0 py-0 text-sm/relaxed shadow-none focus-visible:ring-0 sm:min-h-20"
                disabled={isGenerating || isGeneratingIdea}
                autoFocus
              />
            </div>
            <span className="pt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {prompt.length}/2000
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/45 p-1.5">
            <label className="relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition hover:bg-background">
              <BotIcon className="size-3.5 text-muted-foreground" />
              <span className="max-w-32 truncate">{selectedModel?.label}</span>
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
                size="lg"
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
      </section>
    </main>
  );
}
