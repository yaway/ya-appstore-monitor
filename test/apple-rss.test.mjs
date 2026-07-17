import test from "node:test";
import assert from "node:assert/strict";
import { buildFeedUrl, normalizeFeed } from "../src/apple-rss.mjs";

const market = { code: "us", name: "美国", group: "核心市场" };
const category = { key: "productivity", id: 6007, name: "效率" };

test("buildFeedUrl includes country, limit and genre", () => {
  assert.equal(
    buildFeedUrl(market, category, 100),
    "https://itunes.apple.com/us/rss/toppaidapplications/limit=100/genre=6007/json"
  );
});

test("normalizeFeed keeps rank and computes changes", () => {
  const payload = {
    feed: {
      updated: { label: "2026-07-17T00:00:00Z" },
      entry: [
        {
          "im:name": { label: "Focused Notes" },
          "im:artist": { label: "Northwind Software" },
          "im:image": [{ label: "https://example.com/icon.png" }],
          "im:price": { label: "$4.99", attributes: { amount: "4.99", currency: "USD" } },
          id: { label: "https://apps.apple.com/us/app/id123", attributes: { "im:id": "123" } },
          category: { attributes: { "im:id": "6007", label: "Productivity" } },
          "im:releaseDate": { label: "2026-01-01T00:00:00Z" }
        }
      ]
    }
  };
  const previous = { snapshotDate: "2026-07-16", apps: [{ appleId: "123", rank: 4 }] };
  const chart = normalizeFeed(payload, {
    market,
    category,
    limit: 100,
    snapshotDate: "2026-07-17",
    url: "https://example.com"
  }, previous);

  assert.equal(chart.actualCount, 1);
  assert.equal(chart.apps[0].rank, 1);
  assert.equal(chart.apps[0].previousRank, 4);
  assert.equal(chart.apps[0].rankChange, 3);
  assert.equal(chart.apps[0].price.amount, 4.99);
  assert.equal(chart.status, "partial");
});
