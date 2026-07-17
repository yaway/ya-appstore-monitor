import { createHash } from "node:crypto";

const DEFAULT_PREVIEW_COUNT = 10;

function markdownText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function appLine(app) {
  const name = markdownText(app.name || `App ${app.appleId}`);
  const linkedName = app.storeUrl ? `[${name}](${app.storeUrl})` : name;
  const price = markdownText(app.price?.formatted || "付费");
  const change = app.rankChange > 0
    ? ` · ↑${app.rankChange}`
    : app.rankChange < 0
      ? ` · ↓${Math.abs(app.rankChange)}`
      : "";
  return `**${app.rank}.** ${linkedName} · ${price}${change}`;
}

function chartPageUrl(chart, publicBaseUrl) {
  if (!publicBaseUrl) return null;
  const url = new URL(publicBaseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  url.searchParams.set("country", chart.market.code);
  url.searchParams.set("category", chart.category.key);
  return url.toString();
}

export function buildChartCard(chart, options = {}) {
  const previewCount = options.previewCount ?? DEFAULT_PREVIEW_COUNT;
  const apps = (chart.apps ?? []).slice(0, previewCount);
  const pageUrl = chartPageUrl(chart, options.publicBaseUrl);
  const status = chart.status === "complete" ? "完整" : `实际 ${chart.actualCount} 条`;
  const elements = [
    {
      tag: "markdown",
      content: [
        `**${chart.snapshotDate} · ${markdownText(chart.market.name)}**`,
        `收录 ${chart.actualCount} 条真实排名 · 数据状态：${status}`,
        "",
        ...apps.map(appLine)
      ].join("\n")
    },
    {
      tag: "note",
      elements: [
        {
          tag: "plain_text",
          content: `数据源：${chart.source || "Apple iTunes RSS"} · 卡片展示前 ${apps.length} 名`
        }
      ]
    }
  ];

  if (pageUrl) {
    elements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          type: "primary",
          text: { tag: "plain_text", content: "查看完整榜单" },
          url: pageUrl
        }
      ]
    });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      template: "turquoise",
      title: {
        tag: "plain_text",
        content: `${chart.market.name} · ${chart.category.name} Top ${chart.actualCount}`
      }
    },
    elements
  };
}

export function chartIdempotencyKey(chart, chatId) {
  return createHash("sha256")
    .update(`${chart.snapshotDate}:${chart.market.code}:${chart.category.key}:${chatId}`)
    .digest("hex")
    .slice(0, 32);
}
