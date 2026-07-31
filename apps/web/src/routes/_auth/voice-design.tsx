import { Button } from "@my-better-t-app/ui/components/button";
import { Label } from "@my-better-t-app/ui/components/label";
import { Textarea } from "@my-better-t-app/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
  AudioLinesIcon,
  DownloadIcon,
  Loader2Icon,
  Mic2Icon,
  SparklesIcon,
  Volume2Icon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/voice-design")({
  component: VoiceDesignStudio,
});

type TtsResult = {
  audio: {
    base64: string;
    mediaType: string;
    sampleRate: number;
    format: string;
  };
};

const voiceOptions = [
  { value: "longyingtian", label: "中文女声", preview: "您好，我是龙小春，非常高兴为您服务。" },
  { value: "longshao_v2", label: "中文男声", preview: "大家好，我是龙成，带给您沉稳有力的播报体验。" },
];

const waveformBars = [28, 48, 74, 42, 88, 58, 34, 68, 92, 52, 76, 38, 62, 84, 46, 70, 32];

function VoiceDesignStudio() {
  const [text, setText] = useState("你好！欢迎使用 AI 文本生语音功能，我可以将你输入的文字转化为自然流畅的人声。");
  const [voice, setVoice] = useState(voiceOptions[0].value);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [volume, setVolume] = useState(50);
  const [result, setResult] = useState<TtsResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);

  const audioUrl = useMemo(() => {
    if (!result) return "";
    return `data:${result.audio.mediaType};base64,${result.audio.base64}`;
  }, [result]);

  const handlePlayPreview = async (e: React.MouseEvent, opt: typeof voiceOptions[0]) => {
    e.stopPropagation();
    if (playingPreview === opt.value) return;
    
    setPlayingPreview(opt.value);
    try {
      const audio = new Audio(`/audio/${opt.value}.mp3`);
      audio.onended = () => setPlayingPreview(null);
      audio.onerror = () => {
        setPlayingPreview(null);
        toast.error("无法加载该音色的本地试听文件");
      };
      await audio.play();
    } catch {
      setPlayingPreview(null);
      toast.error("试听播放异常");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCreating || !text.trim()) {
      return;
    }

    setIsCreating(true);
    setResult(null);

    try {
      const response = await fetch("/api/voice-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice,
          speechRate,
          volume,
        }),
      });
      const data = (await response.json()) as TtsResult | { error?: string };

      if (!response.ok || !("audio" in data)) {
        throw new Error("error" in data ? data.error : "语音生成失败");
      }

      setResult(data);
      toast.success("语音已生成，可以试听了");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "语音生成失败，请稍后重试");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="image-library-scrollbar min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top,var(--color-primary)/0.08,transparent_36rem)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-8 text-center sm:mb-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary">
            <Mic2Icon className="size-3.5" />
            AI Text-to-Speech
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI 语音生成</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            使用千问语音大模型，输入想要播报的内容、选择心仪的发音人，一键生成自然流畅的 AI 人声。
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="relative overflow-hidden rounded-2xl border border-border/80 bg-background/90 shadow-xl backdrop-blur-2xl"
            >
              <div className="border-b border-border/60 bg-muted/30 p-5">
                <div className="mb-4">
                  <Label htmlFor="tts-text" className="mb-2 block font-medium">
                    播报文案
                  </Label>
                  <Textarea
                    id="tts-text"
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 2000))}
                    placeholder="输入你想转换为语音的文本内容..."
                    className="min-h-32 resize-y rounded-xl border-border/60 bg-background/50 leading-relaxed focus-visible:ring-primary/40"
                    disabled={isCreating}
                  />
                  <div className="mt-1.5 flex justify-end">
                    <span className="text-[10px] text-muted-foreground">{text.length}/2000</span>
                  </div>
                </div>

                <div className="mb-5">
                  <Label className="mb-3 block font-medium">音色选择</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {voiceOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setVoice(opt.value)}
                        disabled={isCreating}
                        className={`group flex items-center justify-between rounded-xl border p-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                          voice === opt.value
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border/60 bg-background hover:bg-muted"
                        }`}
                      >
                        <span className="text-left leading-tight">{opt.label}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handlePlayPreview(e, opt)}
                          onKeyDown={(e) => e.key === 'Enter' && handlePlayPreview(e as any, opt)}
                          className={`ml-2 inline-flex shrink-0 items-center justify-center rounded-full p-1.5 transition-colors ${
                            playingPreview === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                          title="试听音色"
                        >
                          {playingPreview === opt.value ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            <Volume2Icon className="size-3.5" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label htmlFor="speechRate">声音语速</Label>
                      <span className="text-xs text-muted-foreground">{speechRate.toFixed(1)}x</span>
                    </div>
                    <input
                      id="speechRate"
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={speechRate}
                      onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      disabled={isCreating}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>慢速</span>
                      <span>正常</span>
                      <span>极速</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label htmlFor="volume">音量大小</Label>
                      <span className="text-xs text-muted-foreground">{volume}</span>
                    </div>
                    <input
                      id="volume"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={volume}
                      onChange={(e) => setVolume(parseInt(e.target.value))}
                      disabled={isCreating}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>静音</span>
                      <span>适中</span>
                      <span>最大</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 bg-muted/10 p-4">
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-xl px-8 font-medium shadow-md shadow-primary/20"
                  disabled={isCreating || !text.trim()}
                >
                  {isCreating ? (
                    <>
                      <Loader2Icon className="animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      生成语音
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-6 flex h-full min-h-64 flex-col rounded-2xl border border-border/80 bg-background/90 p-5 shadow-xl backdrop-blur-2xl">
              <div className="mb-4 flex items-center gap-2 font-medium">
                <AudioLinesIcon className="size-4 text-primary" />
                生成结果
              </div>

              {isCreating ? (
                <div className="flex flex-1 flex-col items-center justify-center space-y-4 py-8">
                  <div className="flex items-end gap-1">
                    {waveformBars.slice(0, 7).map((height, i) => (
                      <div
                        key={i}
                        className="w-1.5 animate-pulse rounded-full bg-primary/40"
                        style={{
                          height: `${height}%`,
                          animationDelay: `${i * 100}ms`,
                          animationDuration: "1s",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">正在倾力生成声音...</p>
                </div>
              ) : result ? (
                <div className="flex flex-1 flex-col">
                  <div className="relative mb-6 flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-primary)/0.05,transparent_60%)]" />
                    <div className="flex items-end gap-1.5 opacity-80">
                      {waveformBars.slice(0, 15).map((height, i) => (
                        <div
                          key={i}
                          className="w-1.5 rounded-full bg-primary/80 transition-all duration-300"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <audio
                      controls
                      src={audioUrl}
                      className="w-full"
                      autoPlay
                      controlsList="nodownload"
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="default"
                        className="flex-1 rounded-xl shadow-md"
                        onClick={() => {
                          const anchor = document.createElement("a");
                          anchor.href = audioUrl;
                          anchor.download = `voice_${voice}_${Date.now()}.${result.audio.format}`;
                          anchor.click();
                        }}
                      >
                        <DownloadIcon />
                        下载音频
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-muted-foreground opacity-70">
                  <Volume2Icon className="mb-4 size-10 stroke-1" />
                  <p className="text-sm">在左侧输入文本并点击生成<br />生成的音频将在此展示</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
