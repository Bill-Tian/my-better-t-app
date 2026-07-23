import { Button } from "@my-better-t-app/ui/components/button";
import { Label } from "@my-better-t-app/ui/components/label";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import { Textarea } from "@my-better-t-app/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLineIcon,
  ImageIcon,
  Loader2Icon,
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
// type ImageBackground = "auto" | "opaque" | "transparent";

type GeneratedImage = {
  image: {
    base64: string;
    mediaType: string;
  };
  prompt: string;
  model: string;
};

const examplePrompts = [
  "雨夜里的未来上海街头，霓虹灯倒映在湿润路面，电影感",
  "极简主义香水产品摄影，米白色背景，柔和侧光，高级杂志风",
  "一只戴宇航员头盔的橘猫站在月球，复古科幻海报风格",
];

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

function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  // const [background, setBackground] = useState<ImageBackground>("auto");
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const imageUrl = useMemo(() => {
    if (!result) return "";
    return `data:${result.image.mediaType};base64,${result.image.base64}`;
  }, [result]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();

    if (cleanPrompt.length < 3 || isGenerating) return;

    setIsGenerating(true);
    setResult(null);

    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanPrompt,
          size,
          quality,
          background: 'auto',
        }),
      });
      const data = (await response.json()) as GeneratedImage | { error?: string };

      if (!response.ok || !("image" in data)) {
        throw new Error("error" in data ? data.error : "图片生成失败");
      }

      setResult(data);
      toast.success("图片已生成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片生成失败，请稍后重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;

    const anchor = document.createElement("a");
    anchor.href = imageUrl;
    anchor.download = `ai-image-${Date.now()}.png`;
    anchor.click();
  };

  return (
    <main className="min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,var(--color-primary)/0.09,transparent_28rem)]">
      <div className="mx-auto grid min-h-full w-full max-w-7xl grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="border-b bg-background/85 p-5 backdrop-blur lg:border-r lg:border-b-0 lg:p-7">
          <div className="mb-7">
            <div className="mb-3 flex size-9 items-center justify-center border bg-primary text-primary-foreground">
              <WandSparklesIcon className="size-4" />
            </div>
            <p className="mb-1 text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
              AI Image Studio
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">把想法变成画面</h1>
            <p className="mt-2 text-xs/relaxed text-muted-foreground">
              描述主体、环境、光线和风格，细节越清楚，结果越接近你的想象。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="image-prompt">画面描述</Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {prompt.length}/2000
                </span>
              </div>
              <Textarea
                id="image-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value.slice(0, 2000))}
                placeholder="例如：清晨薄雾中的中式庭院，阳光穿过竹林，胶片质感..."
                className="min-h-32 bg-background/70 text-sm/relaxed"
                disabled={isGenerating}
                autoFocus
              />
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">试试这些灵感</p>
                {examplePrompts.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="block w-full border-l px-2 py-1 text-left text-[11px]/relaxed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    disabled={isGenerating}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">画布比例</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {sizeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={size === option.value}
                    onClick={() => setSize(option.value)}
                    className="border px-2 py-2 text-left transition-colors aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    disabled={isGenerating}
                  >
                    <span className="block text-xs font-medium">{option.label}</span>
                    <span className="block text-[10px] opacity-70">{option.ratio}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">生成质量</legend>
              <div className="grid grid-cols-3 border">
                {qualityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={quality === option.value}
                    onClick={() => setQuality(option.value)}
                    className="border-r px-2 py-2 text-xs transition-colors last:border-r-0 aria-pressed:bg-secondary aria-pressed:text-foreground"
                    disabled={isGenerating}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* <div className="space-y-2">
              <Label htmlFor="image-background">背景</Label>
              <select
                id="image-background"
                value={background}
                onChange={(event) => setBackground(event.target.value as ImageBackground)}
                className="h-8 w-full border border-input bg-background px-2.5 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                disabled={isGenerating}
              >
                <option value="auto">自动选择</option>
                <option value="opaque">不透明背景</option>
                <option value="transparent">透明背景</option>
              </select>
            </div> */}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isGenerating || prompt.trim().length < 3}
            >
              {isGenerating ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  正在绘制
                </>
              ) : (
                <>
                  <SparklesIcon />
                  生成图片
                </>
              )}
            </Button>
            <p className="text-center text-[10px]/relaxed text-muted-foreground">
              AI 生成内容可能存在偏差，请勿用于违法或侵权用途。
            </p>
          </form>
        </section>

        <section className="flex min-h-[32rem] flex-col p-4 sm:p-7 lg:p-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                Canvas
              </p>
              <h2 className="mt-1 text-sm font-medium">生成结果</h2>
            </div>
            {result && (
              <Button type="button" variant="outline" size="sm" onClick={downloadImage}>
                <ArrowDownToLineIcon />
                下载 PNG
              </Button>
            )}
          </div>

          <div className="relative flex min-h-[28rem] flex-1 items-center justify-center overflow-hidden border bg-[linear-gradient(45deg,var(--color-muted)_25%,transparent_25%,transparent_75%,var(--color-muted)_75%),linear-gradient(45deg,var(--color-muted)_25%,transparent_25%,transparent_75%,var(--color-muted)_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]">
            {isGenerating ? (
              <div className="absolute inset-0 bg-background/95 p-5 sm:p-10">
                <Skeleton className="h-full w-full" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="flex size-12 items-center justify-center border bg-background shadow-sm">
                    <Loader2Icon className="size-5 animate-spin" />
                  </div>
                  <p className="mt-4 text-sm font-medium">正在构建画面</p>
                  <p className="mt-1 text-xs text-muted-foreground">高质量图片通常需要一点时间</p>
                </div>
              </div>
            ) : result ? (
              <img
                src={imageUrl}
                alt={result.prompt}
                className="max-h-[calc(100svh-12rem)] max-w-full object-contain"
              />
            ) : (
              <div className="mx-auto max-w-xs px-6 text-center">
                <div className="mx-auto flex size-14 items-center justify-center border bg-background/90 shadow-sm">
                  <ImageIcon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mt-5 text-sm font-medium">画布等待你的想法</h3>
                <p className="mt-2 text-xs/relaxed text-muted-foreground">
                  在左侧输入描述并选择参数，生成的图片会展示在这里。
                </p>
              </div>
            )}
          </div>

          {result && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border px-3 py-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="size-3" />
                {size} · {qualityOptions.find((item) => item.value === quality)?.label}
              </span>
              <span>{result.model}</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
