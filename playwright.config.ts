import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev:api",
      port: 3001,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run dev:web",
      port: 3000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
