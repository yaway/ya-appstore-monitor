export const MARKETS = [
  { code: "us", name: "美国", group: "核心市场" },
  { code: "cn", name: "中国大陆", group: "核心市场" },
  { code: "jp", name: "日本", group: "核心市场" },
  { code: "gb", name: "英国", group: "核心市场" },
  { code: "de", name: "德国", group: "核心市场" },
  { code: "fr", name: "法国", group: "核心市场" },
  { code: "ca", name: "加拿大", group: "核心市场" },
  { code: "au", name: "澳大利亚", group: "核心市场" },
  { code: "kr", name: "韩国", group: "核心市场" },
  { code: "br", name: "巴西", group: "核心市场" },
  { code: "mx", name: "墨西哥", group: "区域市场" },
  { code: "in", name: "印度", group: "区域市场" },
  { code: "vn", name: "越南", group: "区域市场" },
  { code: "hk", name: "中国香港", group: "区域市场" },
  { code: "tw", name: "中国台湾", group: "区域市场" },
  { code: "sg", name: "新加坡", group: "区域市场" },
  { code: "it", name: "意大利", group: "区域市场" },
  { code: "es", name: "西班牙", group: "区域市场" },
  { code: "sa", name: "沙特阿拉伯", group: "区域市场" },
  { code: "ae", name: "阿联酋", group: "区域市场" }
];

export const CATEGORIES = [
  { key: "overall", id: null, name: "付费总榜" },
  { key: "business", id: 6000, name: "商务" },
  { key: "weather", id: 6001, name: "天气" },
  { key: "utilities", id: 6002, name: "工具" },
  { key: "travel", id: 6003, name: "旅游" },
  { key: "sports", id: 6004, name: "体育" },
  { key: "social-networking", id: 6005, name: "社交" },
  { key: "reference", id: 6006, name: "参考资料" },
  { key: "productivity", id: 6007, name: "效率" },
  { key: "photo-video", id: 6008, name: "摄影与录像" },
  { key: "news", id: 6009, name: "新闻" },
  { key: "navigation", id: 6010, name: "导航" },
  { key: "music", id: 6011, name: "音乐" },
  { key: "lifestyle", id: 6012, name: "生活" },
  { key: "health-fitness", id: 6013, name: "健康健美" },
  { key: "games", id: 6014, name: "游戏" },
  { key: "finance", id: 6015, name: "财务" },
  { key: "entertainment", id: 6016, name: "娱乐" },
  { key: "education", id: 6017, name: "教育" },
  { key: "books", id: 6018, name: "图书" },
  { key: "medical", id: 6020, name: "医疗" },
  { key: "magazines-newspapers", id: 6021, name: "报刊杂志" },
  { key: "food-drink", id: 6023, name: "美食佳饮" },
  { key: "shopping", id: 6024, name: "购物" },
  { key: "developer-tools", id: 6026, name: "开发工具" },
  { key: "graphics-design", id: 6027, name: "图形与设计" }
];

export const DEFAULT_LIMIT = 100;
export const DEFAULT_CONCURRENCY = 5;
export const DEFAULT_RETRIES = 3;
export const SOURCE_NAME = "Apple iTunes RSS";

export function snapshotDate(timeZone = "Asia/Hong_Kong") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function selectByEnv(items, envValue, field = "code") {
  if (!envValue) return items;
  const requested = new Set(
    envValue
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  return items.filter((item) => requested.has(String(item[field]).toLowerCase()));
}
