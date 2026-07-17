# App Store 付费榜观察

无需第三方 Key 的 App Store 付费榜监控初版。数据来自 Apple 公开 iTunes RSS，覆盖 20 个主要市场和 26 个顶级分类，每个分类最多保存 100 条真实排名。

## 数据口径

- 每个国家或地区拥有独立榜单，不生成自定义全球综合排名。
- `overall` 是付费总榜，分类榜使用 Apple 顶级 Genre ID。
- Apple RSS 可能对小市场或小分类返回不足 100 条，本项目保存实际结果，不使用模拟数据补齐。
- 排名是采集时刻的榜单快照，不代表下载量或收入。
- 首次运行没有昨日基线，第二天起自动计算排名变化。

## 本地运行

要求 Node.js 20 或更高版本。

```bash
npm test
npm run daily
npm run serve
```

打开 `http://127.0.0.1:4173`。

### 飞书卡片推送

榜单标题右侧的“推送到飞书”按钮会调用本地服务，再由 `lark-cli` 以用户身份向“OpenClaw 体验群”发送榜单卡片。卡片展示前 10 名，并通过 App Store 链接保留真实数据来源。

首次使用需要配置 CLI 并授予最小权限：

```bash
lark-cli auth login --scope "im:chat:read im:message im:message.send_as_user"
npm run serve
```

纯静态托管不能执行本地 CLI，因此 GitHub Pages 上的榜单仍可浏览，但推送按钮需要接入这个 Node 服务。可用配置：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LARK_CHAT_NAME` | `OpenClaw 体验群` | 按群名精确查找并缓存目标群 ID |
| `LARK_CHAT_ID` | 空 | 已知群 ID 时跳过群搜索，适合稳定部署 |
| `LARK_IDENTITY` | `user` | 发送身份，可设置为 `bot`，但机器人必须已入群 |
| `PUBLIC_BASE_URL` | 空 | 公网榜单地址，设置后卡片会出现“查看完整榜单”按钮 |

如需清理旧数据中页面未使用的 App 描述字段，可执行 `npm run compact`。

## 小范围试跑

```bash
MARKETS=cn,us,jp CATEGORIES=overall,games,productivity npm run daily
```

可用环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MARKETS` | 20 个市场 | 逗号分隔市场代码 |
| `CATEGORIES` | 全部分类 | 逗号分隔分类 key |
| `LIMIT` | `100` | 单榜请求数量 |
| `CONCURRENCY` | `5` | 并发请求数 |
| `RETRIES` | `3` | 单请求重试次数 |
| `SNAPSHOT_DATE` | 香港时区当天 | 强制快照日期 |
| `PORT` | `4173` | 本地静态服务端口 |

## 每日任务

`.github/workflows/daily-monitor.yml` 每天 `01:00 UTC` 采集、保存数据并发布 GitHub Pages。首次启用前需要在仓库设置中将 Pages 来源设为 GitHub Actions。

每日归档采用不可变补全策略：

- 当天已有且有效的市场/分类 JSON 会直接复用，不再次请求，也不会覆盖。
- 只抓取当天缺失的榜单文件，适合任务失败后安全续跑。
- 如果 `latest` 已有当天数据但归档缺失，会优先从 `latest` 恢复归档，不重复请求 Apple。
- 同一天重复执行不会清空排名变化，也不会产生无意义的数据提交。
- GitHub Actions 同一分支上的更新会排队执行，避免并发写入和部署冲突。
- “缺失”指榜单文件不存在；Apple 实际返回不足 100 条的有效榜单不会与另一个采集时刻的数据拼接。

## 目录

```text
data/archive/YYYY-MM-DD/   每日历史数据
data/latest/              最新榜单
dist/                     可直接部署的静态网站
```

## 已知限制

Apple 无 Key 公开榜单无法提供真实总榜 Top 1000。这个版本通过各分类 Top 100 扩大真实 App 监控范围，但不会将分类排名冒充为总榜第 101-1000 名。
