import { chromium, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir } from "node:fs/promises";

const HOST = "127.0.0.1";
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;

async function waitForServer(url: string, timeoutMs = 120000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Aguarda próximo ciclo
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  throw new Error(`Dev server não respondeu em ${url}`);
}

async function capture(page: Page, route: string, width: number, height: number, name: string) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `mockups/${name}.png`, fullPage: true });
}

async function run() {
  await mkdir("mockups", { recursive: true });

  const server: ChildProcessWithoutNullStreams = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--host", HOST, "--port", String(PORT)],
    { stdio: "pipe", env: process.env }
  );

  server.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  server.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  let browser: Browser | null = null;

  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch();
    const page = await browser.newPage();

    await capture(page, "/components", 1440, 900, "components-desktop");
    await capture(page, "/", 1440, 900, "dashboard-desktop");
    await capture(page, "/components", 390, 844, "components-mobile");
    await capture(page, "/", 390, 844, "dashboard-mobile");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
