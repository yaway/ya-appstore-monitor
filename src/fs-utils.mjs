import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true });
}

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeJsonIfAbsent(filePath, value) {
  await ensureDir(path.dirname(filePath));
  try {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}
