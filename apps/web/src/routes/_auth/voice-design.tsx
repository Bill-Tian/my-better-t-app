import { Button } from "@my-better-t-app/ui/components/button";
import { Checkbox } from "@my-better-t-app/ui/components/checkbox";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import { Textarea } from "@my-better-t-app/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
  AudioLinesIcon,
  CheckIcon,
  ClipboardIcon,
  DownloadIcon,
  Loader2Icon,
  Mic2Icon,
  SparklesIcon,
  Volume2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/voice-design")({
  component: VoiceDesignStudio,
});

type TargetModel =
  | "qwen3-tts-vd-2026-01-26"
  | "qwen3-tts-vd-realtime-2026-01-15"
  | "cosyvoice-v3.5-plus"
  | "cosyvoice-v3.5-flash"
  | "cosyvoice-v3-plus"
  | "cosyvoice-v3-flash";
type Language = "zh" | "en" | "de" | "it" | "pt" | "es" | "ja" | "ko" | "fr" | "ru";
type SampleRate = 16000 | 24000 | 48000;
type AudioFormat = "wav" | "mp3";

type VoiceDesignResult = {
  voiceId: string;
  targetModel: string;
  previewAudio: {
    base64: string;
    mediaType: string;
    sampleRate: number;
    format: string;
  };
  requestId?: string;
};

const modelOptions: Array<{
  value: TargetModel;
  label: string;
  description: string;
}> = [
  {
    value: "qwen3-tts-vd-2026-01-26",
    label: "Qwen3-TTS VD",
    description: "非实时 · 北京/新加坡",
  },
  {
    value: "qwen3-tts-vd-realtime-2026-01-15",
    label: "Qwen3-TTS VD Realtime",
    description: "实时 · 北京/新加坡",
  },
  {
    value: "cosyvoice-v3.5-plus",
    label: "CosyVoice 3.5 Plus",
    description: "高质量 · 仅北京",
  },
  {
    value: "cosyvoice-v3.5-flash",
    label: "CosyVoice 3.5 Flash",
    description: "低延迟 · 仅北京",
  },
  {
    value: "cosyvoice-v3-plus",
    label: "CosyVoice 3 Plus",
    description: "稳定版 · 仅北京",
  },
  {
    value: "cosyvoice-v3-flash",
    label: "CosyVoice 3 Flash",
    description: "快速版 · 仅北京",
  },
];

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "es", label: "Español" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "ru", label: "Русский" },
];

const voiceExamples = [
  "沉稳的中年男性播音员，音色低沉浑厚而富有磁性，语速平稳，吐字清晰，适合新闻播报和纪录片解说。",
  "年轻活泼的女性声音，音调偏高，语速较快，带有自然的上扬语调，适合时尚产品和直播介绍。",
  "温柔知性的青年女性，声音圆润治愈，语速偏慢，情绪平和，适合有声书与睡前故事。",
  "机敏可爱的少年角色，音色清脆明亮，节奏轻快，带一点好奇感，适合动画与游戏角色配音。",
];

const waveformBars = [28, 48, 74, 42, 88, 58, 34, 68, 92, 52, 76, 38, 62, 84, 46, 70, 32];

const isQwenModel = (model: TargetModel) => model.startsWith("qwen");

function VoiceDesignStudio() {
  const [targetModel, setTargetModel] = useState<TargetModel>("qwen3-tts-vd-2026-01-26");
  const [voiceName, setVoiceName] = useState("studio_voice");
  const [voicePrompt, setVoicePrompt] = useState(voiceExamples[0]);
  const [previewText, setPreviewText] = useState(
    "各位听众朋友，大家好。欢迎来到声音设计工作室，让我们一起创造独特的声音。",
  );
  const [language, setLanguage] = useState<Language>("zh");
  const [sampleRate, setSampleRate] = useState<SampleRate>(24000);
  const [responseFormat, setResponseFormat] = useState<AudioFormat>("wav");
  const [billingAccepted, setBillingAccepted] = useState(false);
  const [result, setResult] = useState<VoiceDesignResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const isQwen = isQwenModel(targetModel);
  const voicePromptLimit = isQwen ? 2048 : 500;
  const previewTextLimit = isQwen ? 1024 : 200;
  const nameLimit = isQwen ? 16 : 10;
  const availableLanguages = isQwen
    ? languageOptions
    : languageOptions.filter((item) => item.value === "zh" || item.value === "en");

  const audioUrl = useMemo(() => {
    if (!result) return "";
    return `data:${result.previewAudio.mediaType};base64,${result.previewAudio.base64}`;
  }, [result]);

  const handleModelChange = (nextModel: TargetModel) => {
    const nextIsQwen = isQwenModel(nextModel);
    setTargetModel(nextModel);
    setResult(null);

    if (!nextIsQwen) {
      setVoiceName((current) => current.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10));
      if (language !== "zh" && language !== "en") setLanguage("zh");
    }
  };

  const handleNameChange = (value: string) => {
    const disallowed = isQwen ? /[^a-zA-Z0-9_]/g : /[^a-zA-Z0-9]/g;
    setVoiceName(value.replace(disallowed, "").slice(0, nameLimit));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      isCreating ||
      voicePrompt.trim().length < 8 ||
      !previewText.trim() ||
      !voiceName ||
      (isQwen && !billingAccepted)
    ) {
      return;
    }

    setIsCreating(true);
    setResult(null);

    try {
      const response = await fetch("/api/voice-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetModel,
          name: voiceName,
          voicePrompt: voicePrompt.trim(),
          previewText: previewText.trim(),
          language,
          sampleRate,
          responseFormat,
        }),
      });
      const data = (await response.json()) as VoiceDesignResult | { error?: string };

      if (!response.ok || !("voiceId" in data)) {
        throw new Error("error" in data ? data.error : "音色创建失败");
      }

      setResult(data);
      toast.success("音色已创建，可以试听了");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "音色创建失败，请稍后重试");
    } finally {
      setIsCreating(false);
    }
  };

  const copyVoiceId = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result.voiceId);
      toast.success("音色 ID 已复制");
    } catch {
      toast.error("复制失败，请手动复制音色 ID");
    }
  };

  const downloadPreview = () => {
    if (!result || !audioUrl) return;

    const anchor = document.createElement("a");
    anchor.href = audioUrl;
    anchor.download = `${voiceName}-preview.${result.previewAudio.format}`;
    anchor.click();
  };

  const canSubmit =
    !isCreating &&
    voicePrompt.trim().length >= 8 &&
    previewText.trim().length > 0 &&
    voiceName.length > 0 &&
    (!isQwen || billingAccepted);

  return (
    <main className="min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,var(--color-primary)/0.08,transparent_30rem)]">
      <div className="mx-auto grid min-h-full w-full max-w-7xl grid-cols-1 lg:grid-cols-[25rem_minmax(0,1fr)]">
        <section className="border-b bg-background/88 p-5 backdrop-blur lg:border-r lg:border-b-0 lg:p-7">
          <div className="mb-7">
            <div className="mb-3 flex size-9 items-center justify-center border bg-primary text-primary-foreground">
              <Mic2Icon className="size-4" />
            </div>
            <p className="mb-1 text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
              Voice Design Lab
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">用文字塑造声音</h1>
            <p className="mt-2 text-xs/relaxed text-muted-foreground">
              无需音频样本。描述年龄、音调、语速、情绪与用途，生成可直接用于语音合成的专属音色。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="voice-model">目标模型</Label>
              <select
                id="voice-model"
                value={targetModel}
                onChange={(event) => handleModelChange(event.target.value as TargetModel)}
                className="h-10 w-full border border-input bg-background px-3 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                disabled={isCreating}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} · {option.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="voice-name">{isQwen ? "音色名称" : "名称前缀"}</Label>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {voiceName.length}/{nameLimit}
                  </span>
                </div>
                <Input
                  id="voice-name"
                  value={voiceName}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder={isQwen ? "studio_voice" : "studio"}
                  className="h-10"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voice-language">预览语言</Label>
                <select
                  id="voice-language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  className="h-10 w-full border border-input bg-background px-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
                  disabled={isCreating}
                >
                  {availableLanguages.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="voice-prompt">声音描述</Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {voicePrompt.length}/{voicePromptLimit}
                </span>
              </div>
              <Textarea
                id="voice-prompt"
                value={voicePrompt}
                onChange={(event) =>
                  setVoicePrompt(event.target.value.slice(0, voicePromptLimit))
                }
                className="min-h-28 bg-background/70 text-sm/relaxed"
                placeholder="例如：温柔知性的青年女性，声音圆润，语速偏慢……"
                disabled={isCreating}
              />
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {voiceExamples.map((example, index) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setVoicePrompt(example.slice(0, voicePromptLimit))}
                    className="border px-2 py-1.5 text-left text-[10px]/relaxed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    disabled={isCreating}
                  >
                    0{index + 1} · {example.slice(0, 19)}…
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="preview-text">预览文案</Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {previewText.length}/{previewTextLimit}
                </span>
              </div>
              <Textarea
                id="preview-text"
                value={previewText}
                onChange={(event) =>
                  setPreviewText(event.target.value.slice(0, previewTextLimit))
                }
                className="min-h-20 bg-background/70 text-xs/relaxed"
                placeholder="输入希望预览音频朗读的内容"
                disabled={isCreating}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sample-rate">采样率</Label>
                <select
                  id="sample-rate"
                  value={sampleRate}
                  onChange={(event) => setSampleRate(Number(event.target.value) as SampleRate)}
                  className="h-9 w-full border border-input bg-background px-2.5 text-xs outline-none focus:border-ring"
                  disabled={isCreating}
                >
                  <option value={16000}>16 kHz · 轻量</option>
                  <option value={24000}>24 kHz · 推荐</option>
                  <option value={48000}>48 kHz · 高保真</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audio-format">预览格式</Label>
                <select
                  id="audio-format"
                  value={responseFormat}
                  onChange={(event) => setResponseFormat(event.target.value as AudioFormat)}
                  className="h-9 w-full border border-input bg-background px-2.5 text-xs outline-none focus:border-ring"
                  disabled={isCreating}
                >
                  <option value="wav">WAV · 无损</option>
                  <option value="mp3">MP3 · 轻量</option>
                </select>
              </div>
            </div>

            {isQwen ? (
              <label className="flex cursor-pointer gap-3 border border-amber-500/30 bg-amber-500/5 p-3 text-[10px]/relaxed text-muted-foreground">
                <Checkbox
                  checked={billingAccepted}
                  onCheckedChange={(checked) => setBillingAccepted(checked === true)}
                  disabled={isCreating}
                  className="mt-0.5"
                />
                <span>
                  我了解：创建 Qwen-TTS 音色可能按 0.2 元/个计费；北京地域新用户可能享有免费额度。
                </span>
              </label>
            ) : (
              <div className="border border-primary/20 bg-primary/5 p-3 text-[10px]/relaxed text-muted-foreground">
                CosyVoice 创建音色免费，仅支持北京地域，建议使用业务空间专属域名。
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
              {isCreating ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  正在塑造音色
                </>
              ) : (
                <>
                  <WandSparklesIcon />
                  创建并生成试听
                </>
              )}
            </Button>
          </form>
        </section>

        <section className="flex min-h-[38rem] flex-col p-4 sm:p-7 lg:p-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                Preview Console
              </p>
              <h2 className="mt-1 text-sm font-medium">音色试听与交付</h2>
            </div>
            {result && (
              <Button type="button" variant="outline" size="sm" onClick={downloadPreview}>
                <DownloadIcon />
                下载试听
              </Button>
            )}
          </div>

          <div className="relative flex min-h-[31rem] flex-1 flex-col overflow-hidden border bg-background/55">
            <div className="flex h-44 items-center justify-center border-b bg-[radial-gradient(circle_at_center,var(--color-primary)/0.12,transparent_65%)] px-6">
              <div className="flex h-24 items-center gap-1">
                {waveformBars.map((height, index) => (
                  <span
                    key={index}
                    className={`w-1.5 bg-primary/70 transition-all ${isCreating ? "animate-pulse" : ""}`}
                    style={{ height: `${height}%`, animationDelay: `${index * 60}ms` }}
                  />
                ))}
              </div>
            </div>

            {isCreating ? (
              <div className="grid flex-1 gap-4 p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center border bg-background">
                    <Loader2Icon className="size-4 animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">正在分析声音特征</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      创建、审核并生成预览音频通常需要一点时间
                    </p>
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : result ? (
              <div className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center border bg-primary text-primary-foreground">
                      <CheckIcon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">音色创建完成</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        先试听确认，再将音色 ID 用于同一目标模型
                      </p>
                    </div>
                  </div>
                  <span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    READY
                  </span>
                </div>

                <div className="border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium">
                    <Volume2Icon className="size-3.5" />
                    预览音频
                  </div>
                  <audio controls src={audioUrl} className="h-10 w-full" preload="metadata">
                    您的浏览器不支持音频播放。
                  </audio>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                    <span>{result.previewAudio.sampleRate / 1000} kHz</span>
                    <span>{result.previewAudio.format.toUpperCase()}</span>
                    <span>{languageOptions.find((item) => item.value === language)?.label}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>音色 ID</Label>
                  <div className="flex min-w-0 border bg-muted/20">
                    <code className="min-w-0 flex-1 overflow-hidden px-3 py-2.5 text-[11px] text-ellipsis whitespace-nowrap">
                      {result.voiceId}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={copyVoiceId}
                      aria-label="复制音色 ID"
                      className="border-l"
                    >
                      <ClipboardIcon />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-px border bg-border sm:grid-cols-3">
                  <div className="bg-background p-3">
                    <p className="text-[9px] tracking-wider text-muted-foreground uppercase">Model</p>
                    <p className="mt-1 truncate text-[10px]" title={result.targetModel}>
                      {result.targetModel}
                    </p>
                  </div>
                  <div className="bg-background p-3">
                    <p className="text-[9px] tracking-wider text-muted-foreground uppercase">Name</p>
                    <p className="mt-1 truncate text-[10px]">{voiceName}</p>
                  </div>
                  <div className="bg-background p-3">
                    <p className="text-[9px] tracking-wider text-muted-foreground uppercase">
                      Request
                    </p>
                    <p className="mt-1 truncate text-[10px]" title={result.requestId}>
                      {result.requestId || "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-auto border-l-2 border-primary px-3 py-1 text-[10px]/relaxed text-muted-foreground">
                  调用语音合成时，必须使用 <strong className="text-foreground">同一个目标模型</strong>
                  ，并将上方音色 ID 作为 voice 参数。
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-7 text-center">
                <div className="flex size-14 items-center justify-center border bg-background shadow-sm">
                  <AudioLinesIcon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mt-5 text-sm font-medium">等待你的声音设定</h3>
                <p className="mt-2 max-w-sm text-xs/relaxed text-muted-foreground">
                  尽量覆盖年龄、音调、语速、情绪、音色特点和使用场景。创建后，这里会出现可播放的试听音频和永久音色 ID。
                </p>
                <div className="mt-7 grid w-full max-w-md grid-cols-3 gap-px border bg-border text-left">
                  {[
                    ["01", "描述", "定义声音特质"],
                    ["02", "创建", "生成专属音色"],
                    ["03", "使用", "复制 ID 合成"],
                  ].map(([number, title, description]) => (
                    <div key={number} className="bg-background p-3">
                      <span className="text-[9px] text-primary">{number}</span>
                      <p className="mt-2 text-xs font-medium">{title}</p>
                      <p className="mt-1 text-[9px] text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border px-3 py-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <SparklesIcon className="size-3" />
              文本驱动 · 无需音频样本
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AudioLinesIcon className="size-3" />
              Voice Design
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
