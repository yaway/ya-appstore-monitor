import { fetchAllCharts } from "./fetch-charts.mjs";
import { buildSite } from "./build-site.mjs";

await fetchAllCharts();
await buildSite();
