import { execSync } from "child_process";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

console.log("=== 1/4 Installing dependencies ===");
run("npm install");

console.log("\n=== 2/4 Configuring environment ===");
const envFile = resolve("apps/api/.env");
const envExample = resolve("apps/api/.env.example");
if (!existsSync(envFile)) {
  copyFileSync(envExample, envFile);
  console.log("Created apps/api/.env from .env.example");
  console.log(">> Edit apps/api/.env and add your OPENAI_API_KEY before using AI chat.");
} else {
  console.log("apps/api/.env already exists, skipping.");
}

console.log("\n=== 3/4 Seeding database ===");
mkdirSync(resolve("apps/api/data"), { recursive: true });
run("npm run seed");

console.log("\n=== 4/4 Starting app (API :3001, Web :3000) ===");
run("npm run dev");
