import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fetchAllCharts } from "../src/fetch-charts.mjs";
import { readJson, writeJson } from "../src/fs-utils.mjs";

const market = { code: "us", name: "美国", group: "核心市场" };
const categories = [
  { key: "overall", id: null, name: "付费总榜" },
  { key: "business", id: 6000, name: "商务" }
];
const date = "2026-07-17";

function chart(category, options = {}) {
  const rank = options.rank ?? 1;
  return {
    schemaVersion: 1,
    snapshotDate: options.snapshotDate ?? date,
    collectedAt: options.collectedAt ?? `2026-07-17T0${category.id ?? 0}:00:00.000Z`,
    sourceUpdatedAt: options.sourceUpdatedAt ?? "2026-07-17T00:00:00Z",
    source: "Apple iTunes RSS",
    chartType: "paid",
    market,
    category,
    requestedLimit: 100,
    actualCount: 1,
    status: "partial",
    apps: [{ appleId: `app-${category.key}`, rank, previousRank: null, rankChange: null }]
  };
}

test("daily collection reuses existing files and fetches only missing charts", async (context) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "ya-appstore-monitor-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  const existingPath = path.join(dataRoot, "archive", date, "us", "overall.json");
  const previousBusiness = chart(categories[1], {
    snapshotDate: "2026-07-16",
    collectedAt: "2026-07-16T01:00:00.000Z",
    rank: 4
  });
  await writeJson(existingPath, chart(categories[0]));
  await writeJson(path.join(dataRoot, "latest", "us", "business.json"), previousBusiness);
  const existingBefore = await readFile(existingPath, "utf8");
  const calls = [];

  const manifest = await fetchAllCharts({
    dataRoot,
    snapshotDate: date,
    markets: [market],
    categories,
    concurrency: 2,
    fetchChartFn: async (options) => {
      calls.push(options);
      return chart(options.category);
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].category.key, "business");
  assert.equal(calls[0].previousSnapshot.snapshotDate, "2026-07-16");
  assert.equal(await readFile(existingPath, "utf8"), existingBefore);
  assert.equal((await readJson(path.join(dataRoot, "archive", date, "us", "business.json"))).snapshotDate, date);
  assert.equal((await readJson(path.join(dataRoot, "latest", "us", "overall.json"))).snapshotDate, date);
  assert.equal(manifest.summary.successfulCharts, 2);
  assert.equal(manifest.summary.failedCharts, 0);
});

test("repeating a complete daily run is a no-op", async (context) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "ya-appstore-monitor-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  let fetchCount = 0;
  const options = {
    dataRoot,
    snapshotDate: date,
    markets: [market],
    categories,
    fetchChartFn: async ({ category }) => {
      fetchCount += 1;
      return chart(category);
    }
  };

  await fetchAllCharts(options);
  const chartPath = path.join(dataRoot, "archive", date, "us", "overall.json");
  const manifestPath = path.join(dataRoot, "archive", date, "manifest.json");
  const chartBefore = await readFile(chartPath, "utf8");
  const manifestBefore = await readFile(manifestPath, "utf8");
  await fetchAllCharts({
    ...options,
    fetchChartFn: async () => {
      throw new Error("completed charts must not be fetched again");
    }
  });

  assert.equal(fetchCount, 2);
  assert.equal(await readFile(chartPath, "utf8"), chartBefore);
  assert.equal(await readFile(manifestPath, "utf8"), manifestBefore);
});

test("current latest data restores a missing archive without fetching", async (context) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "ya-appstore-monitor-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  await writeJson(path.join(dataRoot, "latest", "us", "overall.json"), chart(categories[0]));

  await fetchAllCharts({
    dataRoot,
    snapshotDate: date,
    markets: [market],
    categories: [categories[0]],
    fetchChartFn: async () => {
      throw new Error("current latest data should be recovered without fetching");
    }
  });

  const restored = await readJson(path.join(dataRoot, "archive", date, "us", "overall.json"));
  assert.equal(restored.snapshotDate, date);
  assert.equal(restored.apps[0].appleId, "app-overall");
});
