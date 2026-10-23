import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testIgnore: process.env.MOVATE_PREVIEW_CREDENTIALS
    ? []
    : ["**/serverless.spec.ts"],
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
    ...(process.env.MOVATE_PREVIEW_CREDENTIALS
      ? {
          httpCredentials: JSON.parse(
            readFileSync(process.env.MOVATE_PREVIEW_CREDENTIALS, "utf8"),
          ),
        }
      : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
  ],
});
