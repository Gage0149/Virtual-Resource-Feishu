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

export async function uploadBitableMedia(
  env: Env,
  file: File
): Promise<{ file_token: string }> {
  if (!file.size) throw new FeishuError("不能上传空文件。");
  if (file.size > 20 * 1024 * 1024) {
    throw new FeishuError("单个附件不能超过 20MB；更大的文件需要使用飞书分片上传接口。");
  }
  if (file.name.length > 250) throw new FeishuError("文件名不能超过 250 个字符。");

  const accessToken = await getTenantAccessToken(env);
  const form = new FormData();
  form.append("file_name", file.name);
  form.append("parent_type", file.type.startsWith("image/") ? "bitable_image" : "bitable_file");
  form.append("parent_node", env.FEISHU_APP_TOKEN);
  form.append("size", String(file.size));
  form.append("file", file, file.name);

  const response = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: form
  });
  const result = await response.json() as {
    code?: number; msg?: string; data?: { file_token?: string }
  };
  if (!response.ok || result.code !== 0 || !result.data?.file_token) {
    throw new FeishuError(result.msg || ("上传飞书附件失败（HTTP " + response.status + "）。"), result.code);
  }
  return { file_token: result.data.file_token };
}

export async function downloadBitableMedia(
  env: Env,
  fileToken: string,
  extra?: string
): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{6,160}$/.test(fileToken)) {
    throw new FeishuError("飞书附件 token 格式不正确。");
  }

  const mediaUrl = new URL(
    `/open-apis/drive/v1/medias/${encodeURIComponent(fileToken)}/download`,
    "https://open.feishu.cn"
  );

  if (extra) {
    if (extra.length > 5000) throw new FeishuError("飞书附件权限参数过长。");
    let parsedExtra: unknown;
    try {
      parsedExtra = JSON.parse(extra);
    } catch {
      throw new FeishuError("飞书附件权限参数格式不正确。");
    }
    const bitablePerm = parsedExtra && typeof parsedExtra === "object"
      ? (parsedExtra as Record<string, unknown>).bitablePerm
      : null;
    const tableId = bitablePerm && typeof bitablePerm === "object"
      ? (bitablePerm as Record<string, unknown>).tableId
      : null;
    if (tableId && tableId !== env.FEISHU_RESOURCE_TABLE_ID) {
      throw new FeishuError("附件不属于当前配置的资源数据表。");
    }
    mediaUrl.searchParams.set("extra", extra);
  }

  const accessToken = await getTenantAccessToken(env);
  const upstream = await fetch(mediaUrl.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new FeishuError(`读取飞书封面失败（HTTP ${upstream.status}）。${detail.slice(0, 240)}`);
  }

  const contentType = upstream.headers.get("Content-Type") || "application/octet-stream";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new FeishuError("飞书资源封面字段中的附件不是可显示的图片。");
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff"
  });
  const cacheTag = upstream.headers.get("ETag");
  if (cacheTag) headers.set("ETag", cacheTag);
  return new Response(upstream.body, { status: 200, headers });
}
