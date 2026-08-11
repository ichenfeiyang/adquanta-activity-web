# 自动部署配置

上游仓库 `Ad-Quanta/adquanta-activity-web` 使用同一份 GitHub Actions Workflow 发布两个环境：

| 上游分支 | 构建配置 | 部署目标 |
| --- | --- | --- |
| `master` | 生产 API / GA | 火山对象存储 TOS |
| `test` | 测试 API / GA | Cloudflare R2 |

Workflow 只监听上游仓库的 `master` 和 `test` push 事件。开发者 fork 中的功能分支可以正常提交 PR，但不会获得或使用上游部署凭证：

```text
个人 fork 功能分支 -> PR 到上游 test -> CR -> 合并 -> 自动部署 R2
上游 test -> PR 到上游 master -> CR -> 合并 -> 自动部署 TOS
```

## 上游仓库 Secrets

以下配置在 `Ad-Quanta/adquanta-activity-web` 的 **Settings > Secrets and variables > Actions > Secrets** 中。

生产构建和 TOS 沿用现有名称：

| Secret | 是否必填 | 说明 |
| --- | --- | --- |
| `VITE_ACTIVITY_API_BASE_URL` | 是 | 生产 API HTTPS 根地址 |
| `VITE_GA_MEASUREMENT_ID` | 否 | 生产 GA4 Measurement ID |
| `TOS_ACCESS_KEY_ID` | 是 | TOS Access Key ID |
| `TOS_SECRET_ACCESS_KEY` | 是 | TOS Secret Access Key |
| `TOS_ENDPOINT` | 是 | TOS S3 兼容 Endpoint |
| `TOS_REGION` | 是 | TOS Region |
| `TOS_BUCKET` | 是 | 生产 Bucket |
| `TOS_KEY_PREFIX` | 否 | 对象 Key 前缀；根目录部署时留空 |
| `TOS_CDN_DOMAIN` | 否 | 用于在日志中输出生产访问地址 |

测试构建和 R2 新增：

| Secret | 是否必填 | 说明 |
| --- | --- | --- |
| `TEST_VITE_ACTIVITY_API_BASE_URL` | 是 | 测试 API HTTPS 根地址 |
| `TEST_VITE_GA_MEASUREMENT_ID` | 否 | 测试 GA4 Measurement ID |
| `R2_ACCESS_KEY_ID` | 是 | R2 S3 API Access Key ID |
| `R2_SECRET_ACCESS_KEY` | 是 | R2 S3 API Secret Access Key |
| `R2_ENDPOINT` | 是 | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | 是 | R2 测试 Bucket |
| `R2_KEY_PREFIX` | 否 | 对象 Key 前缀；根目录部署时留空 |
| `R2_PUBLIC_URL` | 否 | R2 公共域名，例如 `https://pub-xxxxx.r2.dev` |

`VITE_*` 值会被编译进浏览器代码，不能放密码或用户 Token。这里沿用 Secrets 只是为了兼容当前仓库配置方式。

R2 API Token 应只授予目标测试 Bucket 的 Object Read & Write 权限，不要使用 Cloudflare Global API Key。测试 API 还需要允许 R2 公共域名或自定义域名的跨域请求。

## Workflow 与上传策略

- Workflow 文件：`.github/workflows/deploy.yml`
- 上传脚本：`scripts/deploy_static.py`
- `master` 使用 TOS 的 virtual-hosted addressing。
- `test` 使用 R2 的 path-style addressing，Region 固定为 `auto`。
- HTML 使用 `Cache-Control: no-cache`，其他静态文件使用一年 immutable 缓存。
- 所有资源成功上传后才上传 `index.html`，避免发布到一半时切换入口。
- 发布脚本不会清空 Bucket，历史 hash 资源建议使用对象存储 Lifecycle 定期清理。
- 同一仓库、同一分支的部署串行执行，避免连续合并互相覆盖。

## R2 SPA 入口

R2 的 `r2.dev` 公共域名不支持默认首页和 SPA fallback。测试入口必须显式使用：

```text
https://pub-xxxxx.r2.dev/index.html
```

直接刷新 `/activity-center` 等 Vue Router 路径会返回 404。若测试环境需要支持深链和刷新，应在 R2 前增加 Cloudflare Worker，将不存在的页面路由回退到 `index.html`。

## 上游保护建议

- `master`、`test` 禁止直接 push，只允许通过 PR 合并。
- 两个分支均要求 CR 和必要的 CI Check。
- `.github/workflows/**`、`scripts/deploy_static.py` 的修改应由指定维护者审核。
- 部署 Secrets 只配置在上游仓库，不配置到个人 fork。
