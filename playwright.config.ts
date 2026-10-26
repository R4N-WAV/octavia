import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5199",
    viewport: { width: 960, height: 540 },
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  webServer: { command: "npm run dev -- --port 5199 --strictPort", url: "http://localhost:5199", reuseExistingServer: true },
});
