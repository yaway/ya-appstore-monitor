import test from "node:test";
import assert from "node:assert/strict";
import { buildChartCard, chartIdempotencyKey } from "../src/lark-card.mjs";

const chart = {
  snapshotDate: "2026-07-17",
  source: "Apple iTunes RSS",
  status: "complete",
  actualCount: 100,
  market: { code: "cn", name: "中国大陆" },
  category: { key: "overall", name: "付费总榜" },
  apps: Array.from({ length: 12 }, (_, index) => ({
    rank: index + 1,
    name: `App ${index + 1}`,
    storeUrl: `https://apps.apple.com/cn/app/id${index + 1}`,
    price: { formatted: "¥6.00" },
    rankChange: index === 0 ? 2 : null
  }))
};

test("buildChartCard creates a top 10 interactive card", () => {
  const card = buildChartCard(chart, { publicBaseUrl: "https://charts.example.com/" });
  assert.equal(card.header.title.content, "中国大陆 · 付费总榜 Top 100");
  assert.match(card.elements[0].content, /\*\*1\.\*\* \[App 1\]/);
  assert.doesNotMatch(card.elements[0].content, /App 11/);
  assert.equal(card.elements.at(-1).actions[0].url, "https://charts.example.com/?country=cn&category=overall");
});

test("chartIdempotencyKey is stable per chart and chat", () => {
  assert.equal(chartIdempotencyKey(chart, "oc_one"), chartIdempotencyKey(chart, "oc_one"));
  assert.notEqual(chartIdempotencyKey(chart, "oc_one"), chartIdempotencyKey(chart, "oc_two"));
});
