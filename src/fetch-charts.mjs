import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES,
  DEFAULT_CONCURRENCY,
  DEFAULT_LIMIT,
  DEFAULT_RETRIES,
  MARKETS,
  selectByEnv,
  snapshotDate as currentSnapshotDate
} from "./config.mjs";
import { fetchChart } from "./apple-rss.mjs";
import { ensureDir, readJson, writeJson, writeJsonIfAbsent } from "./fs-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(projectRoot, "data");

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function runPool(tasks, concurrency, worker) {
  const results = new Array(tasks.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(tasks[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, runWorker));
  return results;
}

function chartFile(root, marketCode, categoryKey) {
  return path.join(root, marketCode, `${categoryKey}.json`);
}

function isChartFor(chart, market, category) {
  return Boolean(
    chart
    && typeof chart.snapshotDate === "string"
    && chart.market?.code === market.code
    && chart.category?.key === category.key
    && Array.isArray(chart.apps)
    && Number.isInteger(chart.actualCount)
    && chart.actualCount === chart.apps.length
  );
}

function isCurrentChart(chart, date, market, category) {
  return isChartFor(chart, market, category) && chart.snapshotDate === date;
}

function sameSnapshot(left, right) {
  return Boolean(left && right && sameJson(left, right));
}

function resultFromChart(chart) {
  return {
    market: chart.market.code,
    category: chart.category.key,
    count: chart.actualCount,
    status: chart.status,
    sourceUpdatedAt: chart.sourceUpdatedAt,
    error: null
  };
}

function comparableManifest(manifest) {
  if (!manifest) return null;
  const { generatedAt, ...comparable } = manifest;
  return comparable;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readMutableJson(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

async function syncLatest(latestPath, chart) {
  const latest = await readMutableJson(latestPath);
  if (sameSnapshot(latest, chart)) return false;
  await writeJson(latestPath, chart);
  return true;
}

export async function fetchAllCharts(options = {}) {
  const date = options.snapshotDate ?? process.env.SNAPSHOT_DATE ?? currentSnapshotDate();
  const markets = options.markets ?? selectByEnv(MARKETS, process.env.MARKETS, "code");
  const categories = options.categories ?? selectByEnv(CATEGORIES, process.env.CATEGORIES, "key");
  const limit = options.limit ?? positiveInteger(process.env.LIMIT, DEFAULT_LIMIT);
  const concurrency = options.concurrency ?? positiveInteger(process.env.CONCURRENCY, DEFAULT_CONCURRENCY);
  const retries = options.retries ?? positiveInteger(process.env.RETRIES, DEFAULT_RETRIES);
  const root = options.dataRoot ?? dataRoot;
  const fetchChartFn = options.fetchChartFn ?? fetchChart;

  if (markets.length === 0) throw new Error("No markets selected");
  if (categories.length === 0) throw new Error("No categories selected");

  const archiveRoot = path.join(root, "archive", date);
  const latestRoot = path.join(root, "latest");
  await Promise.all([ensureDir(archiveRoot), ensureDir(latestRoot)]);

  const tasks = markets.flatMap((market) => categories.map((category) => ({ market, category })));
  let completed = 0;
  let reused = 0;
  let recovered = 0;
  let fetched = 0;
  let failed = 0;

  console.log(
    `Checking ${tasks.length} charts for ${markets.length} markets and ${categories.length} categories (${date})`
  );

  const results = await runPool(tasks, concurrency, async ({ market, category }) => {
    const archivePath = chartFile(archiveRoot, market.code, category.key);
    const latestPath = chartFile(latestRoot, market.code, category.key);
    try {
      let archived;
      try {
        archived = await readJson(archivePath);
      } catch (error) {
        throw new Error(`Existing archive is unreadable and was not overwritten: ${error.message}`);
      }

      if (archived !== null) {
        if (!isCurrentChart(archived, date, market, category)) {
          throw new Error("Existing archive is invalid and was not overwritten");
        }
        await syncLatest(latestPath, archived);
        reused += 1;
        return resultFromChart(archived);
      }

      const latest = await readMutableJson(latestPath);
      if (isCurrentChart(latest, date, market, category)) {
        const created = await writeJsonIfAbsent(archivePath, latest);
        const canonical = created ? latest : await readJson(archivePath);
        if (!isCurrentChart(canonical, date, market, category)) {
          throw new Error("Concurrent archive write produced invalid data");
        }
        await syncLatest(latestPath, canonical);
        recovered += 1;
        return resultFromChart(canonical);
      }

      const chart = await fetchChartFn({
        market,
        category,
        limit,
        snapshotDate: date,
        previousSnapshot: isChartFor(latest, market, category) ? latest : null,
        retries
      });
      if (!isCurrentChart(chart, date, market, category)) {
        throw new Error("Fetched chart failed validation");
      }

      const created = await writeJsonIfAbsent(archivePath, chart);
      const canonical = created ? chart : await readJson(archivePath);
      if (!isCurrentChart(canonical, date, market, category)) {
        throw new Error("Concurrent archive write produced invalid data");
      }
      await syncLatest(latestPath, canonical);
      if (created) fetched += 1;
      else reused += 1;
      return resultFromChart(canonical);
    } catch (error) {
      failed += 1;
      return {
        market: market.code,
        category: category.key,
        count: 0,
        status: "failed",
        sourceUpdatedAt: null,
        error: error.message
      };
    } finally {
      completed += 1;
      if (completed % 10 === 0 || completed === tasks.length) {
        console.log(
          `Progress ${completed}/${tasks.length}, reused ${reused}, recovered ${recovered}, fetched ${fetched}, failed ${failed}`
        );
      }
    }
  });

  const successful = results.length - failed;
  const generatedAt = new Date().toISOString();
  const manifestCandidate = {
    schemaVersion: 1,
    snapshotDate: date,
    generatedAt,
    source: "Apple iTunes RSS",
    chartType: "paid",
    requestedLimit: limit,
    markets,
    categories,
    summary: {
      requestedCharts: tasks.length,
      successfulCharts: successful,
      failedCharts: failed,
      totalEntries: results.reduce((sum, item) => sum + item.count, 0)
    },
    results
  };

  const archiveManifestPath = path.join(archiveRoot, "manifest.json");
  const latestManifestPath = path.join(latestRoot, "manifest.json");
  const existingManifest = await readMutableJson(archiveManifestPath);
  const manifest = sameJson(
    comparableManifest(existingManifest),
    comparableManifest(manifestCandidate)
  )
    ? existingManifest
    : manifestCandidate;

  if (manifest === manifestCandidate) {
    await writeJson(archiveManifestPath, manifest);
  }
  const latestManifest = await readMutableJson(latestManifestPath);
  if (!sameJson(latestManifest, manifest)) {
    await writeJson(latestManifestPath, manifest);
  }

  console.log(
    `Finished ${date}: ${successful}/${tasks.length} charts, ${manifest.summary.totalEntries} entries; reused ${reused}, recovered ${recovered}, fetched ${fetched}, failed ${failed}`
  );
  return manifest;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  fetchAllCharts().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
