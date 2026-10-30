import {
  createSession,
  constantTimeTextMatches,
  expiredSessionCookie,
  getCookie,
  sessionCookie,
  verifySession
} from "./server/auth";
import {
  getTableId,
  listFields,
  listRecords,
  listTables,
  type Env as FeishuEnv
} from "./server/feishu";
import { handleCreate, handleList, handleUpdate } from "./server/table-api";
import { json, readJson, sameOrigin } from "./server/http";

interface WorkerEnv extends FeishuEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me"
]);

async function login(request: Request, env: WorkerEnv): Promise<Response> {
  if (!sameOrigin(request)) return json({ ok: false, message: "Invalid request origin." }, 403);

  if (!env.ADMIN_USERNAME?.trim() || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({
      ok: false,
      message: "请在 Cloudflare Worker 配置 ADMIN_USERNAME、ADMIN_PASSWORD 和 SESSION_SECRET。"
    }, 500);
  }
  if (env.ADMIN_PASSWORD.length < 6) {
    return json({ ok: false, message: "服务端 ADMIN_PASSWORD 配置错误：登录密码至少需要 6 位。" }, 500);
  }

  try {
    const body = await readJson(request);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return json({ ok: false, message: "请输入登录用户名和密码。" }, 400);
    }
    if (username.length > 128 || password.length > 128) {
      return json({ ok: false, message: "用户名或密码长度不能超过 128 位。" }, 400);
    }
    if (password.length < 6) {
      return json({ ok: false, message: "登录密码不能少于 6 位。" }, 400);
    }

    const [usernameOk, passwordOk] = await Promise.all([
      constantTimeTextMatches(username, env.ADMIN_USERNAME.trim()),
      constantTimeTextMatches(password, env.ADMIN_PASSWORD)
    ]);
    if (!usernameOk || !passwordOk) {
      return json({ ok: false, message: "用户名或密码不正确。" }, 401);
    }

    const token = await createSession(env.SESSION_SECRET);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": sessionCookie(request, token)
      }
    });
  } catch {
    return json({ ok: false, message: "登录请求格式不正确。" }, 400);
  }
}

async function handleApi(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, service: "virtual-resource-feishu-worker" });
  }

  if (path === "/api/auth/login" && method === "POST") {
    return login(request, env);
  }

  if (path === "/api/auth/logout" && method === "POST") {
    if (!sameOrigin(request)) return json({ ok: false, message: "Invalid request origin." }, 403);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": expiredSessionCookie(request)
      }
    });
  }

  if (path === "/api/auth/me" && method === "GET") {
    return json({
      authenticated: await verifySession(getCookie(request, "frh_session"), env.SESSION_SECRET)
    });
  }

  if (!path.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }

  if (!PUBLIC_API_PATHS.has(path)) {
    const valid = await verifySession(getCookie(request, "frh_session"), env.SESSION_SECRET);
    if (!valid) return json({ ok: false, message: "请先登录。" }, 401);

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !sameOrigin(request)) {
      return json({ ok: false, message: "Invalid request origin." }, 403);
    }
  }

  if (path === "/api/feishu/test" && method === "GET") {
    const required = [
      "FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_APP_TOKEN",
      "FEISHU_RESOURCE_TABLE_ID", "ADMIN_USERNAME", "ADMIN_PASSWORD", "SESSION_SECRET"
    ] as const;
    const missing = required.filter((key) => !env[key]);
    if (missing.length) {
      return json({ ok: false, stage: "config", message: "缺少服务端配置。", missing }, 500);
    }
    try {
      const result = await listRecords(env, env.FEISHU_RESOURCE_TABLE_ID, { pageSize: 5 });
      const fieldNames = Object.keys(result.items?.[0]?.fields || {});
      return json({
        ok: true,
        stage: "complete",
        message: "飞书只读连接成功。测试接口不会返回资源字段值。",
        sampleCount: result.items?.length ?? 0,
        total: result.total ?? null,
        hasMore: result.has_more ?? false,
        fieldNames
      });
    } catch (error) {
      return json({
        ok: false,
        stage: "feishu",
        message: error instanceof Error ? error.message : "飞书连接失败。"
      }, 502);
    }
  }

  if (path === "/api/feishu/tables" && method === "GET") {
    try {
      return json({ ok: true, data: await listTables(env) });
    } catch (error) {
      return json({ ok: false, message: error instanceof Error ? error.message : "读取数据表列表失败。" }, 502);
    }
  }

  if (path === "/api/feishu/fields" && method === "GET") {
    const tableName = url.searchParams.get("table") || "resources";
    const tableId = getTableId(env, tableName);
    if (!tableId) return json({ ok: false, message: `没有配置 ${tableName} 对应的数据表 ID。` }, 400);
    try {
      return json({ ok: true, table: tableName, data: await listFields(env, tableId) });
    } catch (error) {
      return json({ ok: false, message: error instanceof Error ? error.message : "读取字段失败。" }, 502);
    }
  }

  const collectionMatch = path.match(/^\/api\/(resources|publications|templates)$/);
  if (collectionMatch) {
    const tableName = collectionMatch[1] as "resources" | "publications" | "templates";
    if (method === "GET") return handleList(request, env, tableName);
    if (method === "POST") return handleCreate(request, env, tableName);
    return json({ ok: false, message: "不支持的请求方法。" }, 405);
  }

  const recordMatch = path.match(/^\/api\/(resources|publications|templates)\/([^/]+)$/);
  if (recordMatch) {
    const tableName = recordMatch[1] as "resources" | "publications" | "templates";
    if (method !== "PATCH") return json({ ok: false, message: "不支持的请求方法。" }, 405);
    try {
      const recordId = decodeURIComponent(recordMatch[2]);
      return handleUpdate(request, env, tableName, recordId);
    } catch {
      return json({ ok: false, message: "记录 ID 格式不正确。" }, 400);
    }
  }

  return json({ ok: false, message: "API 路由不存在。" }, 404);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      if (new URL(request.url).pathname.startsWith("/api/")) {
        return await handleApi(request, env);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({
        ok: false,
        message: error instanceof Error ? error.message : "Worker 内部错误。"
      }, 500);
    }
  }
};
