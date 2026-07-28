import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  AudioWaveformIcon,
  BotIcon,
  FilmIcon,
  ImageIcon,
  Layers3Icon,
  MessageSquareTextIcon,
  Mic2Icon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const tools = [
  {
    to: "/image",
    eyebrow: "IMAGE STUDIO",
    title: "AI 图像创作",
    description: "输入一句描述，选择模型与画幅，生成、收藏并管理你的视觉灵感。",
    icon: ImageIcon,
    accent: "from-blue-500/22 via-indigo-500/10 to-transparent",
    meta: "Qwen · Grok · GPT Image",
  },
  {
    to: "/video",
    eyebrow: "VIDEO STUDIO",
    title: "AI 视频创作",
    description: "从文字或一张首帧图片开始，生成适合横屏与竖屏场景的动态视频。",
    icon: FilmIcon,
    accent: "from-fuchsia-500/22 via-violet-500/10 to-transparent",
    meta: "Text to Video · Image to Video",
  },
  {
    to: "/ai",
    eyebrow: "INTELLIGENT CHAT",
    title: "AI 智能对话",
    description: "从想法梳理到文案推演，让对话成为每一次创作的思考伙伴。",
    icon: MessageSquareTextIcon,
    accent: "from-violet-500/22 via-fuchsia-500/10 to-transparent",
    meta: "实时流式响应",
  },
  {
    to: "/voice-design",
    eyebrow: "VOICE LAB",
    title: "AI 声音设计",
    description: "只需描述音色、语气和使用场景，即可塑造可试听的专属声音。",
    icon: AudioWaveformIcon,
    accent: "from-cyan-500/20 via-blue-500/10 to-transparent",
    meta: "Qwen TTS · CosyVoice",
  },
] as const;

const steps = [
  ["01", "描述灵感", "用自然语言说清你脑海中的画面、问题或声音。"],
  ["02", "选择模型", "根据速度、质量和创作方向，选择更合适的 AI 能力。"],
  ["03", "生成与沉淀", "即时预览结果，并将有价值的作品保存在个人空间。"],
] as const;

function HomeComponent() {
  return (
    <main className="app-scrollbar min-h-0 overflow-y-auto">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_18%_10%,oklch(0.62_0.2_260/0.18),transparent_30%),radial-gradient(circle_at_82%_18%,oklch(0.62_0.2_305/0.12),transparent_28%)]" />
        <div className="pointer-events-none absolute top-0 left-1/2 h-[38rem] w-px bg-gradient-to-b from-primary/20 to-transparent" />

        <section className="relative mx-auto grid min-h-[calc(100svh-3.75rem)] w-full max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-[10px] font-medium tracking-[0.18em] text-primary uppercase">
              <SparklesIcon className="size-3.5" />
              Multimodal Creative Studio
            </div>
            <h1 className="text-[clamp(2.7rem,6vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
              把灵感变成
              <span className="mt-2 block bg-gradient-to-r from-primary via-blue-300 to-violet-300 bg-clip-text text-transparent">
                可见、可听、可对话
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-base/relaxed text-muted-foreground sm:text-lg/relaxed">
              Lumen AI 将图像与视频生成、智能对话和声音设计汇聚在同一个创作空间。
              从一个念头开始，更快抵达可以分享的作品。
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/image"
                className="group inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_16px_44px_-18px_var(--color-primary)] transition hover:-translate-y-0.5 hover:bg-primary/90"
              >
                <WandSparklesIcon className="size-4" />
                开始图像创作
                <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/ai"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-5 text-sm font-medium transition hover:border-primary/25 hover:bg-white/7"
              >
                <BotIcon className="size-4 text-primary" />
                与 AI 对话
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                四类创作工具
              </span>
              <span className="inline-flex items-center gap-2">
                <Layers3Icon className="size-3.5 text-primary" />
                多模型自由选择
              </span>
              <span className="inline-flex items-center gap-2">
                <SparklesIcon className="size-3.5 text-primary" />
                作品自动沉淀
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-10 bg-[radial-gradient(circle,oklch(0.64_0.2_260/0.16),transparent_62%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-card/70 p-3 shadow-[0_32px_100px_-36px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
              <div className="flex items-center justify-between px-2 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <ImageIcon className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-medium">AI Image</p>
                    <p className="text-[8px] tracking-wider text-muted-foreground uppercase">
                      Creative session
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2 py-1 text-[8px] text-emerald-300">
                  READY
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_65%_30%,#a5b4fc_0,transparent_22%),linear-gradient(145deg,#172554,#312e81_48%,#111827)] p-3">
                  <div className="h-full rounded-xl border border-white/10 bg-[radial-gradient(circle_at_38%_50%,rgba(255,255,255,0.28),transparent_12%),radial-gradient(circle_at_50%_58%,#38bdf8,transparent_28%)]" />
                </div>
                <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_35%,#f0abfc_0,transparent_18%),linear-gradient(155deg,#312e81,#581c87_52%,#18181b)] p-3">
                  <div className="h-full rounded-xl border border-white/10 bg-[linear-gradient(125deg,transparent_30%,rgba(255,255,255,0.18)_50%,transparent_70%)]" />
                </div>
                <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_35%,#67e8f9_0,transparent_16%),linear-gradient(145deg,#083344,#164e63_48%,#172554)] p-3">
                  <div className="h-full rounded-xl border border-white/10 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.22),transparent_55%)]" />
                </div>
                <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_28%,#fda4af_0,transparent_18%),linear-gradient(145deg,#4c0519,#7c2d12_52%,#1c1917)] p-3">
                  <div className="h-full rounded-xl border border-white/10 bg-[linear-gradient(35deg,rgba(255,255,255,0.2),transparent_45%)]" />
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="flex items-start gap-2">
                  <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <p className="text-[10px]/relaxed text-white/72">
                    一座漂浮在云海之上的未来城市，清晨蓝紫色光线，电影感构图
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[8px] text-muted-foreground">
                  <span>Qwen-image-2.0 · 1:1 · x4</span>
                  <span className="rounded-lg bg-primary px-2.5 py-1.5 font-medium text-primary-foreground">
                    生成图片
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute -right-3 -bottom-5 hidden items-center gap-3 rounded-2xl border border-white/10 bg-background/85 px-4 py-3 shadow-xl backdrop-blur-xl sm:flex">
              <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <Mic2Icon className="size-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium">Voice Design</p>
                <div className="mt-1 flex h-2 items-end gap-0.5">
                  {[5, 8, 4, 10, 6, 9, 3, 7].map((height, index) => (
                    <span
                      key={index}
                      className="w-0.5 rounded-full bg-cyan-300/70"
                      style={{ height }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="border-y border-white/7 bg-white/[0.018]">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-5 py-16 md:grid-cols-2 lg:px-8 lg:py-20 xl:grid-cols-4">
          {tools.map(({ to, eyebrow, title, description, icon: Icon, accent, meta }) => (
            <Link
              key={to}
              to={to}
              className="group relative overflow-hidden rounded-2xl border border-white/8 bg-card/35 p-6 transition hover:-translate-y-1 hover:border-primary/25 hover:bg-card/65 lg:p-8"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-70 transition group-hover:opacity-100`} />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-primary">
                    <Icon className="size-4.5" />
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <p className="mt-8 text-[9px] font-medium tracking-[0.2em] text-primary">
                  {eyebrow}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
                <p className="mt-3 max-w-sm text-sm/relaxed text-muted-foreground">
                  {description}
                </p>
                <p className="mt-7 text-[10px] text-white/45">{meta}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <p className="text-[10px] font-medium tracking-[0.22em] text-primary uppercase">
              One flow, more possibilities
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              从灵感到作品，
              <br />
              只需要三个步骤。
            </h2>
            <p className="mt-5 max-w-md text-sm/relaxed text-muted-foreground">
              不用理解复杂参数。用自然语言描述目标，选择适合的模型，其余交给创作工作流。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-5"
              >
                <span className="font-mono text-[10px] text-primary">{number}</span>
                <h3 className="mt-8 text-sm font-medium">{title}</h3>
                <p className="mt-2 text-xs/relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/7">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-7 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>LUMEN AI STUDIO · 多模态创作空间</span>
          <span>Image · Chat · Voice</span>
        </div>
      </footer>
    </main>
  );
}
