import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "./fs-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = [
  path.join(projectRoot, "data", "latest"),
  path.join(projectRoot, "data", "archive")
];

async function jsonFiles(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await jsonFiles(fullPath));
    if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json") {
      files.push(fullPath);
    }
  }
  return files;
}

let fileCount = 0;
let appCount = 0;
for (const root of roots) {
  for (const filePath of await jsonFiles(root)) {
    const chart = await readJson(filePath);
    if (!Array.isArray(chart?.apps)) continue;
    chart.apps = chart.apps.map(({ summary, ...app }) => app);
    await writeJson(filePath, chart);
    fileCount += 1;
    appCount += chart.apps.length;
  }
}

console.log(`Compacted ${fileCount} chart files and ${appCount} app entries`);
