# 部署说明

同一套 `dist/` 上传到 bucket **根目录**（R2 测试桶 / 火山生产桶）。保持标准 SPA 单入口：`index.html`。

## 原理

线上实际形态不是多 HTML 文件，也不是伪静态文件。入口是 `index.html`，页面加载后由 Vue Router 跳到 `/activity-center`。

| 对象 key | URL |
|----------|-----|
| `index.html` | `/index.html` |
| `assets/*` | JS / CSS chunks |
| `icons/*` | SVG icons |

## 上传

```text
index.html
assets/
icons/
ActivityBridgeHelper.js
favicon.svg
```

## 访问示例

### R2 公共开发 URL

R2 的 `pub-xxxxx.r2.dev` 不支持默认首页，也不支持 Transform Rules。测试入口必须显式带 `index.html`：

```text
https://pub-xxxxx.r2.dev/index.html?token=...&activity_id=1
```

不要访问：

```text
https://pub-xxxxx.r2.dev/
https://pub-xxxxx.r2.dev/activity-center
```

前者会 404，后者没有真实对象，也不会被 rewrite。

### 火山生产

火山线上可以继续用现有入口：

```text
https://activity.moyoung.com?token=...&activity_id=1
```

也就是后端继续配置 `https://activity.moyoung.com`，由线上 CDN / 页面路由进入活动中心。

## Native SDK 联调建议

测试环境若只使用 R2 公共开发 URL，后端 `auth/code` 返回：

```text
https://pub-xxxxx.r2.dev/index.html
```

不要返回裸域名 `https://pub-xxxxx.r2.dev`，因为 R2 公共开发 URL 的根路径不会自动映射到 `index.html`。

## API 地址

在 `.env.local` 配置完整 HTTPS 根地址（必须带 `https://`），`npm run build` 后上传 `dist/`：

```env
VITE_ACTIVITY_API_BASE_URL=https://service-dev.aiwriter.today
```

活动上下文（`activity_id`、用户身份）由 Bearer token 解析，前端无需传 `app_id`。

## Token 与安全

- **首次从 App 打开**：URL 可带 `token`（或 `access_token`），H5 写入 `sessionStorage` 后会从地址栏移除。
- **站内跳转**（首页 ↔ 兑换 ↔ 状态页）：不再在 URL 中传递 token，避免泄露到历史记录、Referer 或日志。
- **API 域名**：仅使用构建时注入的 `VITE_ACTIVITY_API_BASE_URL`，不接受 URL 中的 `base_url` 参数。

### CDN 建议响应头（Cloudflare Transform Rules / 火山 CDN）

| Header | 建议值 |
|--------|--------|
| `Cache-Control` | `index.html` 和固定路径资源：`no-cache`；`assets/*` 中带 Vite 内容哈希的资源：`public, max-age=31536000, immutable` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` 或 CSP `frame-ancestors 'self'` |

Content-Security-Policy 需按实际 API 域名与 GA 域名单独配置。

## 多语言 / Region（Native 必传）

App WebView 里的 `navigator.language` **通常不是手机系统语言**，H5 不能单靠浏览器 API 判断印尼语等语言。

请在 **打开 H5 的 URL** 或 **`initActivity` / `getSession` 返回值** 中至少提供一项：

| 字段 | 示例 | 说明 |
|------|------|------|
| URL `region` | `&region=ID` | 按国家映射 UI 语言（ID→印尼语，PK→乌尔都语…） |
| URL `locale` | `&locale=id-ID` | 直接指定 UI 语言 |
| session `region` | `"region":"ID"` | 与 URL region 相同 |
| session `systemLocale` | `"systemLocale":"id-ID"` | 手机系统语言（推荐） |

当前若 session 只有 `userId/deviceId/activityId/...`，H5 **无法**自动切换为印尼语，只能显示默认英文；用户可在页面右上角手动切换语言。

可选：Native 实现同步桥 `ActivityBridgeHelper.getSystemLocale()`，返回 `id-ID` / `in-ID` 等，H5 已支持读取。

H5 调试：在 WebView 控制台执行（无需 `debug=1`）：

```javascript
JSON.stringify(window.__activityLocaleDebug(), null, 2)
```
