import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  AudioWaveformIcon,
  FilmIcon,
  ImageIcon,
  MessageSquareTextIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

const workspaceTools = [
  {
    to: "/image",
    title: "AI 图像",
    description: "生成图片、查看任务历史并管理灵感图库。",
    icon: ImageIcon,
    action: "开始绘制",
    className: "from-blue-500/16 via-indigo-500/8",
  },
  {
    to: "/video",
    title: "AI 视频",
    description: "通过文字或首帧图片生成视频，并持续查看渲染进度。",
    icon: FilmIcon,
    action: "开始创作",
    className: "from-fuchsia-500/16 via-violet-500/8",
  },
  {
    to: "/ai",
    title: "AI 对话",
    description: "讨论想法、优化提示词，快速整理创作方向。",
    icon: MessageSquareTextIcon,
    action: "新建对话",
    className: "from-violet-500/16 via-fuchsia-500/8",
  },
  {
    to: "/voice-design",
    title: "声音设计",
    description: "通过文字描述塑造可试听、可复用的专属音色。",
    icon: AudioWaveformIcon,
    action: "设计音色",
    className: "from-cyan-500/16 via-blue-500/8",
  },
] as const;

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const displayName = session?.user.name?.trim() || "创作者";

  return (
    <main className="app-scrollbar min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-7 sm:py-14">
        <section className="relative overflow-hidden rounded-3xl border border-white/9 bg-card/55 px-6 py-9 sm:px-9 sm:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,oklch(0.65_0.2_260/0.16),transparent_30rem)]" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] text-primary uppercase">
              <SparklesIcon className="size-3.5" />
              Creative Workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              你好，{displayName}
            </h1>
            <p className="mt-3 text-sm/relaxed text-muted-foreground sm:text-base/relaxed">
              今天想创造什么？从图像、视频、对话或声音开始，让一个简单念头逐渐变成作品。
            </p>
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium tracking-[0.18em] text-primary uppercase">
                Your tools
              </p>
              <h2 className="mt-1 text-lg font-semibold">选择创作工具</h2>
            </div>
            <span className="hidden text-[10px] text-muted-foreground sm:block">
              4 个工具已就绪
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workspaceTools.map(
              ({ to, title, description, icon: Icon, action, className }) => (
                <Link
                  key={to}
                  to={to}
                  className="group relative min-h-64 overflow-hidden rounded-3xl border border-white/8 bg-card/45 p-6 transition hover:-translate-y-1 hover:border-primary/25 hover:bg-card/75"
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${className} to-transparent`}
                  />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between">
                      <span className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <ArrowRightIcon className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <h3 className="mt-12 text-xl font-semibold">{title}</h3>
                    <p className="mt-2 max-w-xs text-xs/relaxed text-muted-foreground">
                      {description}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-8 text-xs font-medium text-primary">
                      {action}
                      <ArrowRightIcon className="size-3.5" />
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        </section>

        <section className="mt-9 grid gap-4 md:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <WandSparklesIcon className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-medium">创作建议</h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  从一个清晰的主体开始，再补充环境、风格和情绪。
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-white/7 bg-black/15 p-4 text-xs/relaxed text-white/65">
              “雨后的未来街道，一位撑透明伞的旅人，蓝紫色霓虹灯光，电影感摄影”
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-3xl border border-white/8 bg-primary/8 p-6">
            <div>
              <p className="text-[10px] font-medium tracking-[0.16em] text-primary uppercase">
                Quick start
              </p>
              <h2 className="mt-2 text-lg font-semibold">从 AI 图像开始</h2>
            </div>
            <Link
              to="/image"
              className="mt-8 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground"
            >
              <ImageIcon className="size-4" />
              打开创作空间
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
