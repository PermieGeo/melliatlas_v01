// Dedicated, local-only database for visual inspection and full-stack demo tests.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const command = process.argv[2];
if (!["prepare", "dev", "e2e"].includes(command)) {
  console.error("Usage: node scripts/demo.mjs <prepare|dev|e2e>");
  process.exit(2);
}
if (existsSync("apps/api/.env")) process.loadEnvFile(resolve("apps/api/.env"));
const base = process.env.DATABASE_URL;
if (!base || process.env.NODE_ENV === "production") {
  console.error(
    "A development DATABASE_URL is required (see apps/api/.env.example)",
  );
  process.exit(2);
}
let url;
try {
  url = new URL(base);
} catch {
  console.error("Invalid DATABASE_URL");
  process.exit(2);
}
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
) {
  console.error("Demo operations require a local PostgreSQL URL");
  process.exit(2);
}
const e2eMode = command === "e2e" || process.env.MELLIATLAS_DEMO_E2E === "1";
url.pathname = e2eMode ? "/melliatlas_demo_e2e" : "/melliatlas_demo";
url.search = "";
url.hash = "";
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  NODE_ENV: "development",
  MELLIATLAS_DEMO_E2E: e2eMode ? "1" : "0",
};

function run(args) {
  const child = spawnSync("pnpm", args, { env, stdio: "inherit" });
  if (child.error) throw child.error;
  if (child.signal) process.exit(1);
  if (child.status !== 0) process.exit(child.status ?? 1);
}

if (command === "prepare" || command === "e2e") {
  run([
    "--filter",
    "@melliatlas/api",
    "exec",
    "tsx",
    "src/db/createDemoDatabase.ts",
  ]);
  run(["db:migrate"]);
  run(["--filter", "@melliatlas/api", "demo:seed"]);
}
if (command === "dev") run(["dev"]);
if (command === "e2e")
  run(["exec", "playwright", "test", "--config=playwright.demo.config.ts"]);
