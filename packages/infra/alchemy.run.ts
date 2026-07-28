import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { config } from "dotenv";

const app = await alchemy("my-better-t-app");
const stage = app.stage ?? "dev";

config({ path: "./.env" });
config({ path: `../../apps/web/.env.${stage}` });

export const web = await TanStackStart("web", {
  cwd: "../../apps/web",
  bindings: {
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    SUB2API_API_KEY: alchemy.secret.env.SUB2API_API_KEY!,
    SUB2API_BASE_URL: alchemy.env.SUB2API_BASE_URL!,
    SUB2API_MODEL: alchemy.env.SUB2API_MODEL!,
    SUB2API_IMAGE_MODEL: alchemy.env.SUB2API_IMAGE_MODEL!,
    DASHSCOPE_API_KEY: alchemy.secret.env.DASHSCOPE_API_KEY!,
    DASHSCOPE_BASE_URL: alchemy.env.DASHSCOPE_BASE_URL!,
    GROK2API_IDEA_MODEL_API_KEY: alchemy.env.GROK2API_IDEA_MODEL_API_KEY!,
    GROK2API_BASE_URL: alchemy.env.GROK2API_BASE_URL!,
    GROK2API_IDEA_MODEL: alchemy.env.GROK2API_IDEA_MODEL!,
    GROK2API_IMAGE_MODEL: alchemy.env.GROK2API_IMAGE_MODEL!,
    GEMINI_API_KEY: alchemy.secret.env.GEMINI_API_KEY!,
    GEMINI_BASE_URL: alchemy.env.GEMINI_BASE_URL!,
    GEMINI_IMAGE_MODEL: alchemy.env.GEMINI_IMAGE_MODEL!,
    GOOGLE_CLIENT_ID: alchemy.secret.env.GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET: alchemy.secret.env.GOOGLE_CLIENT_SECRET!,
  },
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
