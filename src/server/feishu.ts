export interface Env {
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  FEISHU_APP_TOKEN: string;
  FEISHU_RESOURCE_TABLE_ID: string;
  FEISHU_PUBLICATION_TABLE_ID?: string;
  FEISHU_TEMPLATE_TABLE_ID?: string;
  FEISHU_SEARCH_FIELDS?: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}

interface TokenResult {
  code: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
}

export class FeishuError extends Error {
  constructor(message: string, public feishuCode?: number) {
    super(message);
    this.name = "FeishuError";
  }
}

let cachedToken = "";
let cachedUntil = 0;
let tokenPromise: Promise<string> | null = null;

export async function getTenantAccessToken(env: Env): Promise<string> {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    const response = await fetch(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET })
      }
    );
    const result = await response.json() as TokenResult;
    if (!response.ok || result.code !== 0 || !result.tenant_access_token) {
      throw new FeishuError(result.msg || "无法获取飞书 tenant_access_token。", result.code);
    }
    cachedToken = result.tenant_access_token;
    cachedUntil = Date.now() + Math.max(60, (result.expire ?? 7200) - 120) * 1000;
    return cachedToken;
  })();

  try {
    return await tokenPromise;
  } finally {
    tokenPromise = null;
  }
}

export async function feishuRequest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getTenantAccessToken(env);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  const response = await fetch(`https://open.feishu.cn${path}`, { ...init, headers });
  const result = await response.json() as { code?: number; msg?: string; data?: T };
  if (!response.ok || result.code !== 0) {
    throw new FeishuError(result.msg || `飞书 API 请求失败（HTTP ${response.status}）。`, result.code);
  }
  return result.data as T;
}

export function getTableId(env: Env, name: string): string {
  if (name === "resources") return env.FEISHU_RESOURCE_TABLE_ID;
  if (name === "publications") return env.FEISHU_PUBLICATION_TABLE_ID || "";
  if (name === "templates") return env.FEISHU_TEMPLATE_TABLE_ID || "";
  return "";
}

export function buildRecordsPath(
  env: Env,
  tableId: string,
  params: { pageSize?: number; pageToken?: string; keyword?: string }
): string {
  const url = new URL(
    `/open-apis/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(tableId)}/records`,
    "https://open.feishu.cn"
  );
  url.searchParams.set("page_size", String(Math.min(500, Math.max(1, params.pageSize ?? 50))));
  if (params.pageToken) url.searchParams.set("page_token", params.pageToken);

  const keyword = params.keyword?.trim();
  if (keyword) {
    const fields = (env.FEISHU_SEARCH_FIELDS || "资源名称,资源编号,资源简介")
      .split(",").map((field) => field.trim()).filter(Boolean);
    if (fields.length) {
      url.searchParams.set("filter", JSON.stringify({
        conjunction: "or",
        conditions: fields.map((field_name) => ({
          field_name, operator: "contains", value: [keyword]
        }))
      }));
    }
  }
  return url.pathname + url.search;
}

export interface BitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
  created_time?: number;
  last_modified_time?: number;
}

export interface RecordListData {
  items?: BitableRecord[];
  total?: number;
  has_more?: boolean;
  page_token?: string;
}

export async function listRecords(
  env: Env,
  tableId: string,
  params: { pageSize?: number; pageToken?: string; keyword?: string }
): Promise<RecordListData> {
  return feishuRequest<RecordListData>(env, buildRecordsPath(env, tableId, params));
}

export async function createRecord(
  env: Env, tableId: string, fields: Record<string, unknown>
): Promise<BitableRecord> {
  const data = await feishuRequest<{ record: BitableRecord }>(
    env,
    `/open-apis/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(tableId)}/records`,
    { method: "POST", body: JSON.stringify({ fields }) }
  );
  return data.record;
}

export async function updateRecord(
  env: Env, tableId: string, recordId: string, fields: Record<string, unknown>
): Promise<BitableRecord> {
  const data = await feishuRequest<{ record: BitableRecord }>(
    env,
    `/open-apis/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
    { method: "PUT", body: JSON.stringify({ fields }) }
  );
  return data.record;
}

export async function listTables(env: Env): Promise<unknown> {
  return feishuRequest(
    env,
    `/open-apis/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables?page_size=100`
  );
}

export async function listFields(env: Env, tableId: string): Promise<unknown> {
  return feishuRequest(
    env,
    `/open-apis/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(tableId)}/fields?page_size=100`
  );
}