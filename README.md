# Virtual Resource Feishu — Cloudflare Workers 版

私人飞书资源管理工作台。**本项目使用 Cloudflare Workers + Workers Static Assets，不使用 Cloudflare Pages，也不使用 Pages Functions。** React/Vite 前端和 Worker API 由同一个 Worker 部署。

## 功能

- 管理员用户名 + 密码登录（密码至少 6 位；HttpOnly、HMAC 签名会话 Cookie）
- 飞书自建应用 tenant_access_token 服务端获取
- 飞书多维表格连接测试
- 读取数据表列表与字段定义
- 资源记录分页、关键词筛选
- 资源库默认画廊卡片视图：宽屏桌面每行 5 张卡片，封面优先读取飞书「资源封面」附件，缺少图片时显示分类主题占位图；展示简介、标签、网盘配置和各平台发布状态；可随时切换表格视图
- 资源新增与编辑（根据飞书字段定义生成可视化表单，支持文本、数字、单选、多选、日期、开关、超链接和附件上传，保存后写回飞书）
- 链接维护视图（百度网盘、夸克网盘链接配置情况和状态）
- 可选的发布记录表和文案模板表
- GitHub + Cloudflare Workers Builds 自动部署

> 当前版本是可用 MVP。资源编辑器使用飞书原始 fields JSON，以兼容不同字段类型。正式批量操作前，请先用少量测试记录验证字段格式。

## 1. 技术架构

```text
GitHub main branch
       |
       v
Cloudflare Workers Builds
  1) bun run build
  2) npx wrangler deploy
       |
       v
Cloudflare Worker: virtual-resource-feishu
  +-- Worker API (/api/*)
  +-- Workers Static Assets (./dist)
       |
       v
Feishu Bitable API (唯一数据源)
```

- Worker 入口：`src/worker.ts`
- Worker API 逻辑：`src/server/`
- React 前端：`src/`
- 静态构建目录：`dist/`
- Worker 和静态资源绑定：根目录 `wrangler.toml` 中的 `[assets]`
- `functions/` / Pages Functions 已从本版本移除。

## 2. 环境要求

- Bun 1.x 或 Node.js 20+
- 飞书开放平台企业自建应用
- Cloudflare 账号
- GitHub 仓库

## 3. 安装和本地配置

```bash
bun install
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`，填写真实配置。不要提交 `.dev.vars`。

### 必填运行时变量

| 变量 | 类型建议 | 说明 |
|---|---|---|
| `FEISHU_APP_ID` | 普通变量 | 飞书自建应用 App ID |
| `FEISHU_APP_SECRET` | Secret | 飞书自建应用 App Secret |
| `FEISHU_APP_TOKEN` | 普通变量 | 多维表格 app_token |
| `FEISHU_RESOURCE_TABLE_ID` | 普通变量 | 资源总库 table_id |
| `ADMIN_USERNAME` | 普通变量 | 后台登录用户名，例如 `admin` |
| `ADMIN_PASSWORD` | Secret | 后台登录密码，至少 6 位 |
| `SESSION_SECRET` | Secret | HMAC 会话签名密钥，建议至少 32 个随机字符；不是登录密码 |

### 可选运行时变量

| 变量 | 说明 |
|---|---|
| `FEISHU_PUBLICATION_TABLE_ID` | 发布记录表 table_id，配置后启用发布内容页 |
| `FEISHU_TEMPLATE_TABLE_ID` | 文案模板表 table_id，配置后启用模板页 |
| `FEISHU_SEARCH_FIELDS` | 逗号分隔的文本搜索字段名，默认 `资源名称,资源编号,资源简介` |

`FEISHU_SEARCH_FIELDS` 的字段名必须与飞书多维表格中的名称完全一致。搜索使用 Bitable filter 的 `contains` 条件，字段类型必须支持该条件。

生成签名密钥示例：

```bash
openssl rand -hex 32
```

不要把 `FEISHU_APP_SECRET`、`ADMIN_PASSWORD` 或 `SESSION_SECRET` 写入 `wrangler.toml`、GitHub 源码或前端代码。

## 4. 飞书应用配置

1. 在飞书开放平台创建或打开企业自建应用。
2. 记录 App ID 和 App Secret。
3. 为应用开通多维表格读取权限；需要新增和更新时，也开通相应写入权限。
4. 在目标多维表格中将应用添加为文档应用/协作者，并授予相应权限。
5. 发布或启用应用，使权限生效。
6. 获取多维表格 `app_token`。
7. 获取资源总库 `table_id`。
8. 将这些值配置到本地 `.dev.vars` 和 Cloudflare Worker 运行时变量中。

注意：App ID、app_token、table_id 是三个不同的值，不能互相替代。

## 5. 本地运行 Worker

先安装依赖并创建 `.dev.vars`，然后：

```bash
bun run build
bunx wrangler dev
```

打开 Wrangler 输出的本地地址。默认通常为 `http://localhost:8787`。

检查服务：

- `/`：管理网页
- `/api/health`：Worker 健康检查
- 登录后在页面「连接与设置」点击「开始测试」：飞书只读连接测试

也可以直接执行：

```bash
bun run dev:worker
```

这个命令会先构建前端，再启动 Wrangler Worker 本地开发服务器。

`bun run dev` 仅启动 Vite 前端开发服务器，不包含 Worker API；需要测试登录和飞书接口时，请使用 `bun run dev:worker`。

## 6. GitHub + Cloudflare Workers Builds 部署

本项目就是给 Cloudflare **Worker** 使用的，不要创建 Pages 项目，也不要使用 `wrangler pages deploy`。

### 6.1 连接 GitHub

1. Cloudflare Dashboard → Workers & Pages。
2. 打开你现有的 Worker `virtual-resource-feishu`，或创建 Worker。
3. 在 Worker 的 Settings / Builds 中连接 GitHub 仓库 `Gage0149/Virtual-Resource-Feishu`。
4. 生产分支选择 `main`。
5. Root directory 设置为 `/`。

### 6.2 Workers Builds 配置

| Cloudflare 设置项 | 填写内容 |
|---|---|
| Build command | `bun run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |
| Preview builds | 初次上线建议先关闭；稳定后再启用 |
| Build output directory | Workers Builds 页面通常不需要单独填写；静态资源目录由 `wrangler.toml` 的 `assets.directory = "./dist"` 指定 |

**不要把 Deploy command 改成 `npx wrangler pages deploy`。** 本项目的 Worker 配置已经包含 `main = "src/worker.ts"`，因此正确部署命令是 `npx wrangler deploy`。

### 6.3 在 Worker 中配置运行时变量

进入：

`Workers & Pages → virtual-resource-feishu → Settings → Variables and Secrets`

请配置 Production 环境的运行时变量（不是 Build variables）：

普通变量：

- `ADMIN_USERNAME`
- `FEISHU_APP_ID`
- `FEISHU_APP_TOKEN`
- `FEISHU_RESOURCE_TABLE_ID`
- `FEISHU_PUBLICATION_TABLE_ID`（可选）
- `FEISHU_TEMPLATE_TABLE_ID`（可选）
- `FEISHU_SEARCH_FIELDS`（可选）

加密 Secrets：

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `FEISHU_APP_SECRET`

保存后重新部署，使新运行时配置生效。

### 6.4 Worker Builds API Token

Workers Builds 需要一个可部署 Worker 的 Cloudflare API Token。可以使用 Cloudflare 为 Workers Builds 自动创建的 Token，或按 Cloudflare 当前界面的权限要求创建 Token。该 Token 是 CI/CD 部署凭证，与飞书 App Secret、管理员密码完全不同。不要把它写进项目源码。

## 7. 登录账号设置

例如：

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你自己设置的至少6位密码
SESSION_SECRET=一串随机生成的长密钥
```

登录页面只需要输入用户名和密码。`SESSION_SECRET` 是后台签名 Cookie 的内部密钥，不会显示在登录页面，也不是你日常输入的密码。

如果旧 Worker 已经配置过 `SESSION_SECRET`，升级时保留原值即可。管理员密码建议不要使用 `123456` 等容易猜到的数字组合。因为密码最低允许 6 位，生产环境建议额外启用 Cloudflare Access 或 WAF Rate Limiting。

## 8. API 路由

| 路由 | 方法 | 用途 |
|---|---|---|
| `/api/health` | GET | Worker 健康检查 |
| `/api/auth/login` | POST | 管理员登录 |
| `/api/auth/logout` | POST | 退出登录 |
| `/api/auth/me` | GET | 检查登录状态 |
| `/api/feishu/test` | GET | 飞书连接测试 |
| `/api/feishu/attachments/:fileToken` | GET | 登录后通过 Worker 下载飞书多维表格封面附件 |
| `/api/feishu/tables` | GET | 获取多维表格数据表列表 |
| `/api/feishu/fields?table=resources` | GET | 获取字段定义 |
| `/api/resources` | GET | 分页查询资源 |
| `/api/resources` | POST | 新增资源 |
| `/api/resources/:recordId` | PATCH | 更新资源 |
| `/api/publications` | GET/POST | 查询/新增发布记录（需配置表 ID） |
| `/api/publications/:recordId` | PATCH | 更新发布记录 |
| `/api/templates` | GET/POST | 查询/新增文案模板（需配置表 ID） |
| `/api/templates/:recordId` | PATCH | 更新文案模板 |

除登录、会话检查和健康检查外，API 路由均需要有效的登录会话。

## 9. 安全与当前版本边界

- 飞书多维表格是唯一数据源，本项目没有本地资源数据库缓存。
- 飞书 App Secret、管理员密码和会话密钥只在 Worker 运行时使用，不进入浏览器。
- 登录使用 HttpOnly、SameSite=Strict Cookie；会话有效期 8 小时。
- 登录系统当前为单管理员账号，不提供注册或找回密码功能。
- 密码最低 6 位是易用性取舍，不代表高强度安全；请使用不易猜测的密码并考虑启用 Cloudflare Access。
- 当前没有持久化登录失败计数器，建议在 Cloudflare WAF 对登录接口配置限流。
- 资源卡片优先读取飞书 `资源封面` 附件字段；Worker 通过已登录的服务端会话代理下载飞书附件图片，并支持多维表格高级权限返回的 `extra` 参数。如果记录没有封面，使用资源分类主题图作为占位。给飞书记录的 `资源封面` 字段上传图片后，网页会显示真实封面。
- 宽屏桌面默认每行 5 张资源卡片；较窄屏幕会按可用宽度响应式调整为 4、3、2 或 1 列。
- 链接维护页目前展示百度/夸克链接字段是否配置，不会自动验证网盘分享链接是否失效。
- 发布记录和文案模板页需要分别创建飞书数据表并配置 table_id。
- 资源编辑已改为可视化表单：根据飞书字段定义渲染常用字段控件；附件支持保留、移除和上传，单文件限制 20MB。发布记录与文案模板仍沿用原始 JSON 编辑器。
- 暂不提供物理删除接口，避免误删。
- Token 缓存是 Worker isolate 内的尽力缓存，不保证跨实例共享。

## 10. 可视化资源编辑器

资源库的「新增资源」和「编辑资源」使用可视化表单。表单会先读取 `/api/feishu/fields?table=resources` 的字段定义，再按字段类型显示输入框、数字、单选、多选、日期、开关、超链接和附件控件。字段按基础信息、网盘链接、发布管理和其他信息分组。只提交实际修改过的字段，未修改字段不会覆盖。

附件上传通过 Worker 服务端调用飞书素材上传接口，图片使用 `bitable_image`，普通文件使用 `bitable_file`，上传目标为当前多维表格 `app_token`。飞书单次素材上传接口限制 20MB；更大的附件需另行实现分片上传。

## 11. 后续建议

1. 根据实际飞书字段定义制作专用可视化编辑表单。
2. 为资源编号、分类、标签、网盘链接建立专用组件。
3. 增加字段级校验和并发编辑冲突提示。
4. 增加文案模板变量替换和发布记录与资源的关联选择。
5. 评估飞书 API 配额和性能后，再考虑增加搜索索引；飞书仍作为唯一权威数据源。
