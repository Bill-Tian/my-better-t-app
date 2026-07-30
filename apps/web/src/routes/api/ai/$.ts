import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@my-better-t-app/env/server";
import { createFileRoute } from "@tanstack/react-router";
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
  convertToModelMessages,
} from "ai";

export const Route = createFileRoute("/api/ai/$")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages }: { messages: UIMessage[] } = await request.json();

          if (!env.DASHSCOPE_API_KEY) {
            return new Response(
              JSON.stringify({ error: "尚未配置 DASHSCOPE_API_KEY" }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const qwen = createOpenAI({
            name: "qwen",
            apiKey: env.DASHSCOPE_API_KEY,
            baseURL:
              (env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com").replace(
                /\/+$/,
                "",
              ) + "/compatible-mode/v1",
          });

          const result = streamText({
            model: qwen.chat("qwen-max"),
            messages: await convertToModelMessages(messages),
          });

          return createUIMessageStreamResponse({
            stream: toUIMessageStream({ stream: result.stream }),
          });
        } catch (error) {
          console.error("AI API error:", error);
          return new Response(JSON.stringify({ error: "Failed to process AI request" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

