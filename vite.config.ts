import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Project Pages URL: https://<user>.github.io/<repo>/ — must match repository name. */
const GITHUB_PAGES_BASE = "/FREQ/";

export default defineConfig(({ command }) => ({
  /** `vite build` embeds this base so assets resolve on GitHub Pages project URLs. */
  base: command === "build" ? GITHUB_PAGES_BASE : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.worktrees/**", "**/dist/**"]
  }
}));
