import { useChat } from "@ai-sdk/react";
import { Bubble, BubbleContent } from "@my-better-t-app/ui/components/bubble";
import { Button } from "@my-better-t-app/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@my-better-t-app/ui/components/input-group";
import {
  Message,
  MessageContent as MessageBody,
  MessageHeader,
} from "@my-better-t-app/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@my-better-t-app/ui/components/message-scroller";
import { Tooltip, TooltipContent, TooltipTrigger } from "@my-better-t-app/ui/components/tooltip";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import {
  ArrowUpIcon,
  BotIcon,
  ImageIcon,
  LightbulbIcon,
  Loader2,
  RotateCwIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Streamdown } from "streamdown";

export const Route = createFileRoute("/ai")({
  component: RouteComponent,
});

function RouteComponent() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai",
    }),
  });
  const isSending = status === "submitted" || status === "streaming";

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    sendMessage({ text });
    setInput("");
  };

  const handlePromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const resetConversation = () => {
    setInput("");
    setMessages([]);
  };

  return (
    <MessageScrollerProvider>
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_0%,var(--color-primary)/0.09,transparent_32rem)]">
        <header className="shrink-0 border-b border-white/7 bg-background/55 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <BotIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <h1 className="text-sm font-medium">AI 智能对话</h1>
                <p className="text-[10px]/relaxed text-muted-foreground">
                  梳理想法、生成内容，也可以帮你完善创作提示词
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="重置对话"
                      onClick={resetConversation}
                      disabled={isSending}
                      className="rounded-lg bg-white/3"
                    />
                  }
                >
                  <RotateCwIcon />
                </TooltipTrigger>
                <TooltipContent>重置对话</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1">
          {messages.length === 0 && !isSending ? (
            <div className="mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center px-5 py-10 text-center">
              <div className="relative flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_60px_-20px_var(--color-primary)]">
                <SparklesIcon className="size-6" />
              </div>
              <p className="mt-6 text-[10px] font-medium tracking-[0.2em] text-primary uppercase">
                Creative Copilot
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                今天想一起创造什么？
              </h2>
              <p className="mt-3 max-w-md text-xs/relaxed text-muted-foreground">
                可以从一个模糊念头开始。AI 会帮你补充细节、整理方向，并把想法变得更具体。
              </p>
              <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-3">
                {[
                  {
                    icon: ImageIcon,
                    title: "完善图像提示词",
                    prompt: "帮我把一个简单想法扩展成适合 AI 生图的提示词",
                  },
                  {
                    icon: LightbulbIcon,
                    title: "策划创意方向",
                    prompt: "帮我为一个新项目构思三个有差异的创意方向",
                  },
                  {
                    icon: WandSparklesIcon,
                    title: "优化内容表达",
                    prompt: "帮我把一段内容改得更简洁、更有吸引力",
                  },
                ].map(({ icon: Icon, title, prompt }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-left text-xs transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/6"
                  >
                    <Icon className="size-4 text-primary" />
                    <span className="mt-5 block font-medium">{title}</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      点击填入
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent
                  aria-busy={isSending}
                  className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-6"
                >
                  {messages.map((message) => {
                    const isUser = message.role === "user";

                    return (
                      <MessageScrollerItem key={message.id} scrollAnchor={isUser}>
                        <Message align={isUser ? "end" : "start"}>
                          <MessageBody>
                            <MessageHeader>{isUser ? "你" : "Lumen AI"}</MessageHeader>
                            <Bubble
                              align={isUser ? "end" : "start"}
                              variant={isUser ? "default" : "secondary"}
                            >
                              <BubbleContent>
                                {message.parts?.map((part, index) => {
                                  if (part.type === "text") {
                                    return (
                                      <Streamdown
                                        key={index}
                                        isAnimating={
                                          status === "streaming" && message.role === "assistant"
                                        }
                                      >
                                        {part.text}
                                      </Streamdown>
                                    );
                                  }
                                  return null;
                                })}
                              </BubbleContent>
                            </Bubble>
                          </MessageBody>
                        </Message>
                      </MessageScrollerItem>
                    );
                  })}
                  {status === "submitted" && (
                    <MessageScrollerItem>
                      <Message align="start">
                        <MessageBody>
                          <Bubble variant="secondary">
                            <BubbleContent className="flex items-center gap-2">
                              <Loader2 className="size-3.5 animate-spin" />
                              <span className="shimmer">Thinking...</span>
                            </BubbleContent>
                          </Bubble>
                        </MessageBody>
                      </Message>
                    </MessageScrollerItem>
                  )}
                  <MessageScrollerItem scrollAnchor />
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          )}
        </main>
        <footer className="shrink-0 border-t border-white/7 bg-background/65 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
            <form onSubmit={handleSubmit} className="w-full">
              <InputGroup className="rounded-2xl border-white/10 bg-white/[0.035] shadow-[0_16px_50px_-30px_rgba(0,0,0,0.9)]">
                <InputGroupTextarea
                  name="prompt"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  placeholder="描述你的问题或想法…"
                  className="max-h-32 min-h-14"
                  rows={1}
                  autoComplete="off"
                  autoFocus
                  disabled={isSending}
                />
                <InputGroupAddon align="block-end" className="pt-1">
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    disabled={isSending || !input.trim()}
                    className="ml-auto rounded-lg"
                  >
                    {isSending ? <Loader2 className="animate-spin" /> : <ArrowUpIcon />}
                    <span className="sr-only">发送</span>
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
            <p className="text-center text-[9px] text-muted-foreground">
              Enter 发送 · Shift + Enter 换行
            </p>
          </div>
        </footer>
      </div>
    </MessageScrollerProvider>
  );
}
