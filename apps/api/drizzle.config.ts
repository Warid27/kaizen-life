import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    // For local dev with `wrangler dev`, D1 uses a local SQLite file.
    // For drizzle-kit push/generate, point to the local file.
    url: "./kaizenlife.db",
  },
});
