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

          console.log("messages",messages);

          const sub2api = createOpenAI({
            name: "chatgpt-5.5",
            apiKey: env.SUB2API_API_KEY,
            baseURL: env.SUB2API_BASE_URL,
          });

          const result = streamText({
            model: sub2api.chat(env.SUB2API_MODEL),
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
