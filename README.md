# AdQuanta Activity Web（Vue 3 + Vite）

活动中心、金币兑换和充值结果页的 H5 活动平台。

## 本地开发

```bash
npm install
npm run dev
```

如需联调接口，复制 `.env.example` 为 `.env.local` 并设置 `VITE_ACTIVITY_API_BASE_URL`。

本仓库统一使用 **npm**（见 `package.json` 的 `packageManager` 字段与 `package-lock.json`）。

## 构建与部署

```bash
npm run build
```

产物在 `dist/`。这是标准 Vue SPA：只有一个 HTML 入口 `index.html`，路由由 Vue Router 处理（`/activity-center`、`/gold-coins-exchange`、`/topup-status`）。

上传到 bucket 根目录即可。详见 [docs/cloudflare-r2-spa.md](./docs/cloudflare-r2-spa.md)。

| 环境 | 存储 | 建议入口 |
|------|------|----------|
| 测试 | R2 test bucket 公共开发 URL | `https://pub-xxxxx.r2.dev/index.html` |
| 生产 | 火山 TOS prod bucket | `https://activity.moyoung.com` |

R2 公共开发 URL 不支持默认首页和 SPA fallback，所以测试环境后端 `auth/code` 的 `url` 应返回完整 `index.html` 地址。页面加载后由 Vue Router 进入 `/activity-center`。

## GitHub Actions 自动部署

仓库已提供 `master` 分支自动部署工作流：

- 工作流文件：`.github/workflows/deploy-to-tos.yml`
- 上传脚本：`scripts/deploy_to_tos.py`（只上传 `dist/`）
- 触发条件：代码 `push` 到 `master` 后自动执行
- 流程：`npm ci` → `npm test` → `npm run build` → 上传 `dist/`

### 需要配置的 GitHub Secrets

构建：

- `VITE_ACTIVITY_API_BASE_URL`
- `VITE_GA_MEASUREMENT_ID`

TOS 上传：

- `TOS_ACCESS_KEY_ID`
- `TOS_SECRET_ACCESS_KEY`
- `TOS_ENDPOINT`
- `TOS_REGION`
- `TOS_BUCKET`
- `TOS_KEY_PREFIX`
- `TOS_CDN_DOMAIN`

其中典型值示例：

- `TOS_ENDPOINT`: `https://tos-s3-cn-guangzhou.volces.com`
- `TOS_REGION`: `cn-guangzhou`
- `TOS_BUCKET`: `ad-quanta`
- `TOS_KEY_PREFIX`: 可留空，或填如 `activity-web`
- `TOS_CDN_DOMAIN`: `https://ad-quanta-cdn.moyoung.com`
