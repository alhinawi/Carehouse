import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8788",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npx wrangler pages dev dist --port 8788",
    url: "http://127.0.0.1:8788",
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
