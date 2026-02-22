import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const publicDir = resolve(process.cwd(), "public");
const socketUrl = process.env.SOCKET_SERVER_URL || "";
const payload = `window.__APP_CONFIG__ = { SOCKET_URL: ${JSON.stringify(socketUrl)} };\n`;

await mkdir(publicDir, { recursive: true });
await writeFile(resolve(publicDir, "config.js"), payload, "utf8");
console.log("public/config.js gerado");
