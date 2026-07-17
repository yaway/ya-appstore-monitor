const PAGE_SIZE = 25;

const elements = {
  marketSelect: document.querySelector("#market-select"),
  categorySelect: document.querySelector("#category-select"),
  searchInput: document.querySelector("#search-input"),
  chartBody: document.querySelector("#chart-body"),
  chartTitle: document.querySelector("#chart-title"),
  chartDetail: document.querySelector("#chart-detail"),
  chartState: document.querySelector("#chart-state"),
  pushButton: document.querySelector("#push-button"),
  pushButtonLabel: document.querySelector("#push-button-label"),
  pushFeedback: document.querySelector("#push-feedback"),
  tableShell: document.querySelector("#table-shell"),
  loadingState: document.querySelector("#loading-state"),
  message: document.querySelector("#message"),
  previousPage: document.querySelector("#previous-page"),
  nextPage: document.querySelector("#next-page"),
  pageStatus: document.querySelector("#page-status"),
  snapshotDate: document.querySelector("#snapshot-date"),
  marketCount: document.querySelector("#market-count"),
  categoryCount: document.querySelector("#category-count"),
  entryCount: document.querySelector("#entry-count")
};

const state = {
  manifest: null,
  chart: null,
  filteredApps: [],
  page: 1,
  pushing: false
};

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function formatInteger(value) {
  return new Intl.NumberFormat("zh-CN").format(value ?? 0);
}

function formatDate(value) {
  if (!value) return "未知日期";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function setOptions(select, items, valueField, label) {
  select.replaceChildren(
    ...items.map((item) => {
      const option = document.createElement("option");
      option.value = item[valueField];
      option.textContent = label(item);
      return option;
    })
  );
}

function selectedMarket() {
  return state.manifest.markets.find((item) => item.code === elements.marketSelect.value);
}

function selectedCategory() {
  return state.manifest.categories.find((item) => item.key === elements.categorySelect.value);
}

function setLoading(isLoading) {
  elements.tableShell.setAttribute("aria-busy", String(isLoading));
  elements.loadingState.hidden = !isLoading;
  if (isLoading) {
    elements.pushButton.disabled = true;
    elements.chartState.className = "chart-state";
    elements.chartState.textContent = "正在加载";
  }
}

function resetPushState() {
  state.pushing = false;
  elements.pushButton.disabled = !state.chart;
  elements.pushButton.setAttribute("aria-busy", "false");
  elements.pushButton.classList.remove("success");
  elements.pushFeedback.className = "push-feedback";
  elements.pushButtonLabel.textContent = "推送到飞书";
  elements.pushFeedback.textContent = "";
}

function showMessage(message = "") {
  elements.message.hidden = !message;
  elements.message.textContent = message;
}

function updateUrl() {
  const params = new URLSearchParams();
  params.set("country", elements.marketSelect.value);
  params.set("category", elements.categorySelect.value);
  const query = elements.searchInput.value.trim();
  if (query) params.set("query", query);
  history.replaceState(null, "", `${location.pathname}?${params}`);
}

function changeMarkup(app) {
  if (app.rankChange === null) return '<span class="change-none">暂无</span>';
  if (app.rankChange > 0) return `<span class="change-up">+${app.rankChange}</span>`;
  if (app.rankChange < 0) return `<span class="change-down">${app.rankChange}</span>`;
  return '<span class="change-none">0</span>';
}

function appRow(app) {
  const row = document.createElement("tr");

  const rank = document.createElement("td");
  rank.className = "rank-column";
  rank.textContent = app.rank;

  const appCell = document.createElement("td");
  appCell.className = "app-cell";
  const link = document.createElement("a");
  link.className = "app-link";
  link.href = app.storeUrl || "#";
  link.target = "_blank";
  link.rel = "noreferrer";
  const image = document.createElement("img");
  image.className = "app-icon";
  image.src = app.iconUrl || "";
  image.alt = "";
  image.width = 48;
  image.height = 48;
  image.loading = "lazy";
  const appText = document.createElement("span");
  const appName = document.createElement("span");
  appName.className = "app-name";
  appName.textContent = text(app.name) || `App ${app.appleId}`;
  const category = document.createElement("span");
  category.className = "app-category";
  category.textContent = text(app.primaryCategory?.name) || "未分类";
  appText.append(appName, category);
  link.append(image, appText);
  appCell.append(link);

  const developer = document.createElement("td");
  developer.className = "developer-column";
  const developerName = document.createElement("span");
  developerName.className = "developer-name";
  developerName.textContent = text(app.developer) || "未知开发者";
  developer.append(developerName);

  const price = document.createElement("td");
  price.className = "price-column";
  price.textContent = text(app.price?.formatted) || "付费";

  const change = document.createElement("td");
  change.className = "change-column";
  change.innerHTML = changeMarkup(app);

  row.append(rank, appCell, developer, price, change);
  return row;
}

function renderTable() {
  const totalPages = Math.max(1, Math.ceil(state.filteredApps.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * PAGE_SIZE;
  const visible = state.filteredApps.slice(start, start + PAGE_SIZE);
  elements.chartBody.replaceChildren(...visible.map(appRow));
  elements.pageStatus.textContent = `第 ${state.page} / ${totalPages} 页`;
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= totalPages;

  if (state.chart?.status === "empty") {
    showMessage("Apple 当前没有返回该市场的这个付费分类榜。请切换分类查看其他真实榜单。");
  } else if (visible.length === 0) {
    showMessage("没有符合当前搜索条件的 App。请更换关键词。 ");
  } else if (state.chart?.status === "partial") {
    showMessage(`该分类本次只返回 ${state.chart.actualCount} 条真实记录。页面未补充模拟数据。`);
  } else {
    showMessage("");
  }
}

function applySearch() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase();
  const apps = state.chart?.apps ?? [];
  state.filteredApps = query
    ? apps.filter((app) => `${app.name} ${app.developer}`.toLocaleLowerCase().includes(query))
    : apps;
  state.page = 1;
  renderTable();
  updateUrl();
}

async function loadChart() {
  state.chart = null;
  setLoading(true);
  resetPushState();
  showMessage("");
  updateUrl();
  const market = selectedMarket();
  const category = selectedCategory();
  elements.chartTitle.textContent = `${market.name} ${category.name}`;
  elements.chartDetail.textContent = "读取榜单数据";

  try {
    const response = await fetch(`data/${market.code}/${category.key}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.chart = await response.json();
    state.filteredApps = state.chart.apps ?? [];
    state.page = 1;
    elements.chartDetail.textContent = `${state.chart.actualCount} 条记录，采集于 ${new Date(state.chart.collectedAt).toLocaleString("zh-CN")}`;
    elements.chartState.className = "chart-state";
    elements.chartState.textContent = state.chart.status === "complete" ? "数据完整" : "部分数据";
    resetPushState();
    renderTable();
  } catch (error) {
    state.chart = null;
    resetPushState();
    state.filteredApps = [];
    elements.chartBody.replaceChildren();
    elements.chartDetail.textContent = "当前榜单不可用";
    elements.chartState.className = "chart-state failed";
    elements.chartState.textContent = "载入失败";
    showMessage(`无法读取该榜单：${error.message}`);
    renderTable();
  } finally {
    setLoading(false);
  }
}

async function pushCurrentChart() {
  if (!state.chart || state.pushing) return;
  state.pushing = true;
  elements.pushButton.disabled = true;
  elements.pushButton.setAttribute("aria-busy", "true");
  elements.pushButton.classList.remove("success");
  elements.pushFeedback.className = "push-feedback";
  elements.pushButtonLabel.textContent = "正在推送";
  elements.pushFeedback.textContent = "正在连接飞书 CLI";

  try {
    const response = await fetch("/api/push-card", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        marketCode: state.chart.market.code,
        categoryKey: state.chart.category.key
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    elements.pushButton.classList.add("success");
    elements.pushButton.setAttribute("aria-busy", "false");
    elements.pushButtonLabel.textContent = "已推送";
    elements.pushFeedback.classList.add("success");
    elements.pushFeedback.textContent = `已发送到 ${result.chatName}`;
    navigator.vibrate?.(8);
  } catch (error) {
    elements.pushButton.setAttribute("aria-busy", "false");
    elements.pushButtonLabel.textContent = "重新推送";
    elements.pushFeedback.classList.add("failed");
    elements.pushFeedback.textContent = `推送失败：${error.message}`;
    elements.pushButton.disabled = false;
  } finally {
    state.pushing = false;
  }
}

async function init() {
  setLoading(true);
  try {
    const response = await fetch("data/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.manifest = await response.json();

    setOptions(elements.marketSelect, state.manifest.markets, "code", (item) => `${item.name} (${item.code.toUpperCase()})`);
    setOptions(elements.categorySelect, state.manifest.categories, "key", (item) => item.name);

    const params = new URLSearchParams(location.search);
    const requestedMarket = params.get("country");
    const requestedCategory = params.get("category");
    const requestedQuery = params.get("query") ?? "";
    if (state.manifest.markets.some((item) => item.code === requestedMarket)) {
      elements.marketSelect.value = requestedMarket;
    }
    if (state.manifest.categories.some((item) => item.key === requestedCategory)) {
      elements.categorySelect.value = requestedCategory;
    }
    elements.searchInput.value = requestedQuery;

    elements.snapshotDate.textContent = formatDate(state.manifest.snapshotDate);
    elements.marketCount.textContent = formatInteger(state.manifest.markets.length);
    elements.categoryCount.textContent = formatInteger(state.manifest.categories.length);
    elements.entryCount.textContent = formatInteger(state.manifest.summary.totalEntries);
    await loadChart();
    if (requestedQuery) applySearch();
  } catch (error) {
    elements.chartState.className = "chart-state failed";
    elements.chartState.textContent = "初始化失败";
    elements.chartTitle.textContent = "榜单数据不可用";
    showMessage(`无法读取今日清单：${error.message}`);
    setLoading(false);
  }
}

elements.marketSelect.addEventListener("change", loadChart);
elements.categorySelect.addEventListener("change", loadChart);
elements.searchInput.addEventListener("input", applySearch);
elements.pushButton.addEventListener("click", pushCurrentChart);
elements.previousPage.addEventListener("click", () => {
  state.page -= 1;
  renderTable();
});
elements.nextPage.addEventListener("click", () => {
  state.page += 1;
  renderTable();
});

init();
