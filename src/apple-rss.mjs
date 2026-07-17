import { SOURCE_NAME } from "./config.mjs";

const DEFAULT_TIMEOUT_MS = 20_000;

export function buildFeedUrl(market, category, limit) {
  const genre = category.id ? `/genre=${category.id}` : "";
  return `https://itunes.apple.com/${market.code}/rss/toppaidapplications/limit=${limit}${genre}/json`;
}

function label(value, fallback = "") {
  return value?.label ?? fallback;
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeEntry(entry, rank, previousRanks = new Map()) {
  const appleId = String(entry?.id?.attributes?.["im:id"] ?? "");
  if (!appleId) return null;

  const previousRank = previousRanks.get(appleId) ?? null;
  const priceAmount = numberValue(entry?.["im:price"]?.attributes?.amount);
  const images = Array.isArray(entry?.["im:image"]) ? entry["im:image"] : [];
  const category = entry?.category?.attributes ?? {};
  const release = entry?.["im:releaseDate"];

  return {
    rank,
    previousRank,
    rankChange: previousRank === null ? null : previousRank - rank,
    isNew: previousRank === null,
    appleId,
    name: label(entry?.["im:name"]),
    developer: label(entry?.["im:artist"]),
    developerUrl: entry?.["im:artist"]?.attributes?.href ?? null,
    iconUrl: images.at(-1)?.label ?? null,
    storeUrl: entry?.id?.label ?? entry?.link?.attributes?.href ?? null,
    price: {
      amount: priceAmount,
      currency: entry?.["im:price"]?.attributes?.currency ?? null,
      formatted: label(entry?.["im:price"], priceAmount === null ? "" : String(priceAmount))
    },
    primaryCategory: {
      id: category["im:id"] ?? null,
      name: category.label ?? null
    },
    releaseDate: release?.attributes?.label ?? release?.label ?? null
  };
}

export function normalizeFeed(payload, context, previousSnapshot = null) {
  const rawEntries = payload?.feed?.entry;
  const entries = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : [];
  const previousRanks = new Map(
    (previousSnapshot?.apps ?? []).map((app) => [String(app.appleId), app.rank])
  );
  const apps = entries
    .map((entry, index) => normalizeEntry(entry, index + 1, previousRanks))
    .filter(Boolean);
  const ranks = new Set(apps.map((app) => app.rank));
  const ids = new Set(apps.map((app) => app.appleId));
  const expectedCount = Math.min(context.limit, entries.length || context.limit);
  const issues = [];

  if (ranks.size !== apps.length) issues.push("duplicate_rank");
  if (ids.size !== apps.length) issues.push("duplicate_app");
  if (apps.length === 0) issues.push("empty_chart");
  if (apps.length < Math.min(50, context.limit)) issues.push("short_chart");

  return {
    schemaVersion: 1,
    snapshotDate: context.snapshotDate,
    collectedAt: new Date().toISOString(),
    sourceUpdatedAt: payload?.feed?.updated?.label ?? null,
    source: SOURCE_NAME,
    sourceUrl: context.url,
    chartType: "paid",
    market: context.market,
    category: context.category,
    requestedLimit: context.limit,
    expectedCount,
    actualCount: apps.length,
    status: issues.includes("empty_chart") ? "empty" : issues.includes("short_chart") ? "partial" : "complete",
    issues,
    previousSnapshotDate: previousSnapshot?.snapshotDate ?? null,
    apps
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJsonWithRetry(url, options = {}) {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": "AppStorePaidChartMonitor/1.0"
        }
      });
      if (!response.ok) {
        throw new Error(`Apple RSS returned HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

export async function fetchChart({ market, category, limit, snapshotDate, previousSnapshot, retries }) {
  const url = buildFeedUrl(market, category, limit);
  const payload = await fetchJsonWithRetry(url, { retries });
  return normalizeFeed(
    payload,
    { market, category, limit, snapshotDate, url },
    previousSnapshot
  );
}
