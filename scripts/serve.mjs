import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendChartCard } from "../src/lark-cli.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const larkChatName = process.env.LARK_CHAT_NAME ?? "OpenClaw 体验群";
const larkChatId = process.env.LARK_CHAT_ID ?? "";
const larkIdentity = process.env.LARK_IDENTITY ?? "user";
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? "";
let cachedChatId = larkChatId;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function loadRequestedChart(marketCode, categoryKey) {
  const manifest = JSON.parse(await readFile(path.join(root, "data", "manifest.json"), "utf8"));
  const market = manifest.markets.find((item) => item.code === marketCode);
  const category = manifest.categories.find((item) => item.key === categoryKey);
  if (!market || !category) throw new Error("榜单参数无效");
  return JSON.parse(
    await readFile(path.join(root, "data", market.code, `${category.key}.json`), "utf8")
  );
}

async function handlePush(request, response) {
  try {
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      sendJson(response, 415, { ok: false, error: "仅接受 JSON 请求" });
      return;
    }
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host) {
      sendJson(response, 403, { ok: false, error: "拒绝跨站推送请求" });
      return;
    }
    const body = await readJsonBody(request);
    const chart = await loadRequestedChart(body.marketCode, body.categoryKey);
    const result = await sendChartCard(chart, {
      chatName: larkChatName,
      chatId: cachedChatId,
      identity: larkIdentity,
      publicBaseUrl
    });
    cachedChatId = result.chatId;
    sendJson(response, 200, {
      ok: true,
      chatName: larkChatName,
      messageId: result.messageId
    });
  } catch (error) {
    const badRequest = ["请求内容过大", "榜单参数无效"].includes(error.message)
      || error instanceof SyntaxError;
    sendJson(response, badRequest ? 400 : 502, {
      ok: false,
      error: badRequest ? "请求无效" : error.message
    });
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestPath = decodeURIComponent(requestUrl.pathname);
  if (request.method === "POST" && requestPath === "/api/push-card") {
    await handlePush(request, response);
    return;
  }
  if (requestPath.startsWith("/api/")) {
    sendJson(response, 404, { ok: false, error: "接口不存在" });
    return;
  }
  const safePath = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = path.join(root, safePath === "/" ? "index.html" : safePath);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = path.join(filePath, "index.html");
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      "cache-control": filePath.endsWith("manifest.json") ? "no-cache" : "public, max-age=300"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`App Store monitor available at http://127.0.0.1:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Open http://127.0.0.1:${port} or set PORT to another value.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});
