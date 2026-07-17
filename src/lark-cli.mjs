import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildChartCard, chartIdempotencyKey } from "./lark-card.mjs";

const execFileAsync = promisify(execFile);
const CLI_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cliErrorMessage(error) {
  const payload = parseJson(error.stdout) ?? parseJson(error.stderr);
  return payload?.error?.message || payload?.error?.hint || error.message || "飞书 CLI 调用失败";
}

async function runLarkCli(args) {
  try {
    const { stdout } = await execFileAsync("lark-cli", args, {
      encoding: "utf8",
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      windowsHide: true
    });
    const payload = parseJson(stdout);
    if (!payload) throw new Error("飞书 CLI 返回了无法解析的结果");
    if (payload.ok === false) throw new Error(payload.error?.message || "飞书 CLI 调用失败");
    return payload;
  } catch (error) {
    throw new Error(cliErrorMessage(error), { cause: error });
  }
}

export async function resolveLarkChatId(chatName, identity = "user") {
  const payload = await runLarkCli([
    "im",
    "+chat-search",
    "--query",
    chatName,
    "--disable-search-by-user",
    "--page-size",
    "20",
    "--as",
    identity,
    "--format",
    "json"
  ]);
  const matches = (payload.data?.chats ?? []).filter((chat) => chat.name === chatName);
  if (matches.length === 0) {
    throw new Error(`当前飞书${identity === "user" ? "用户" : "机器人"}身份看不到群「${chatName}」`);
  }
  if (matches.length > 1) {
    throw new Error(`发现 ${matches.length} 个同名群「${chatName}」，请通过 LARK_CHAT_ID 指定目标`);
  }
  return matches[0].chat_id;
}

export async function sendChartCard(chart, options = {}) {
  const identity = options.identity ?? "user";
  const chatId = options.chatId || await resolveLarkChatId(options.chatName, identity);
  const card = buildChartCard(chart, { publicBaseUrl: options.publicBaseUrl });
  const payload = await runLarkCli([
    "im",
    "+messages-send",
    "--chat-id",
    chatId,
    "--msg-type",
    "interactive",
    "--content",
    JSON.stringify(card),
    "--idempotency-key",
    chartIdempotencyKey(chart, chatId),
    "--as",
    identity,
    "--format",
    "json"
  ]);
  return {
    chatId,
    messageId: payload.data?.message_id ?? payload.message_id ?? null
  };
}
