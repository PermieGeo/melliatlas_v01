import { defineConfig, devices } from "@playwright/test";

/** Full-stack tests against the dedicated, seeded local melliatlas_demo database. */
export default defineConfig({
  testDir: "./tests/demo",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    { name: "demo-desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "demo-mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm demo:dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
