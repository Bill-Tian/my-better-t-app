import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("my-better-t-app");

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
    SUB2API_IDEA_MODEL_API_KEY: alchemy.secret.env.SUB2API_IDEA_MODEL_API_KEY!,
    DASHSCOPE_BASE_URL: alchemy.env.DASHSCOPE_BASE_URL!,
    XAI_API_KEY: alchemy.secret.env.XAI_API_KEY!,
    XAI_BASE_URL: alchemy.env.XAI_BASE_URL || alchemy.env.SUB2API_BASE_URL!,
    XAI_IMAGE_MODEL: alchemy.env.XAI_IMAGE_MODEL || "grok-imagine-image",
    SUB2API_IDEA_MODEL: alchemy.env.SUB2API_IDEA_MODEL || "grok-4.5",
    GOOGLE_CLIENT_ID: alchemy.secret.env.GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET: alchemy.secret.env.GOOGLE_CLIENT_SECRET!,
  },
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
