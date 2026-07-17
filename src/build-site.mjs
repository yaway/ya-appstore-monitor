import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(projectRoot, "site");
const latestRoot = path.join(projectRoot, "data", "latest");
const distRoot = path.join(projectRoot, "dist");

export async function buildSite() {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(path.join(distRoot, "data"), { recursive: true });
  await cp(siteRoot, distRoot, { recursive: true });
  await cp(latestRoot, path.join(distRoot, "data"), { recursive: true });
  console.log(`Static site built at ${distRoot}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  buildSite().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
