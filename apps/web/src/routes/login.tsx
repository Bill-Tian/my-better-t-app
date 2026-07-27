import { createFileRoute } from "@tanstack/react-router";
import {
  AudioWaveformIcon,
  ImageIcon,
  MessageSquareTextIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <main className="app-scrollbar min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_20%_20%,var(--color-primary)/0.12,transparent_32rem)]">
      <div className="mx-auto grid min-h-full w-full max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-[1fr_28rem] md:px-8">
        <section className="hidden max-w-xl md:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-[10px] font-medium tracking-[0.18em] text-primary uppercase">
            <SparklesIcon className="size-3.5" />
            Lumen AI Studio
          </div>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.03] tracking-[-0.045em]">
            一个账号，
            <br />
            开启多模态创作。
          </h1>
          <p className="mt-5 max-w-md text-sm/relaxed text-muted-foreground">
            登录后即可使用 AI 图像、智能对话和声音设计，并在个人空间中持续沉淀作品。
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              { icon: ImageIcon, label: "AI 图像" },
              { icon: MessageSquareTextIcon, label: "智能对话" },
              { icon: AudioWaveformIcon, label: "声音设计" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
              >
                <Icon className="size-4 text-primary" />
                <p className="mt-5 text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full">
          {showSignIn ? (
            <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
          )}
        </section>
      </div>
    </main>
  );
}
