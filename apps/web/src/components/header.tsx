import { Link } from "@tanstack/react-router";
import {
  AudioWaveformIcon,
  FilmIcon,
  ImageIcon,
  LayoutGridIcon,
  MessageSquareTextIcon,
  SparklesIcon,
} from "lucide-react";

import UserMenu from "./user-menu";

const links = [
  { to: "/dashboard", label: "工作台", icon: LayoutGridIcon },
  { to: "/image", label: "AI 图像", icon: ImageIcon },
  { to: "/video", label: "AI 视频", icon: FilmIcon },
  { to: "/ai", label: "AI 对话", icon: MessageSquareTextIcon },
  { to: "/voice-design", label: "声音设计", icon: AudioWaveformIcon },
] as const;

export default function Header() {
  return (
    <header className="relative z-40 border-b border-white/8 bg-background/78 backdrop-blur-2xl">
      <div className="mx-auto flex h-15 w-full max-w-[90rem] items-center gap-3 px-3 sm:px-5">
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-xl pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Lumen AI 首页"
        >
          <span className="relative flex size-8 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-[0_0_28px_-8px_var(--color-primary)]">
            <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent,white/22)]" />
            <SparklesIcon className="relative size-4" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold tracking-[0.08em]">LUMEN</span>
            <span className="-mt-0.5 block text-[8px] font-medium tracking-[0.24em] text-muted-foreground">
              AI STUDIO
            </span>
          </span>
        </Link>

        <nav className="image-library-scrollbar ml-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:ml-4">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              activeProps={{
                className:
                  "bg-primary/12 text-primary ring-1 ring-primary/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
              }}
            >
              <Icon className="size-3.5" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <UserMenu />
      </div>
    </header>
  );
}
