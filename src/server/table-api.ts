import {
  createRecord, getTableId, listRecords, updateRecord, type Env
} from "./feishu";
import { json, readJson } from "./http";

type TableName = "resources" | "publications" | "templates";

export async function handleList(request: Request, env: Env, tableName: TableName): Promise<Response> {
  const tableId = getTableId(env, tableName);
  if (!tableId) return json({
    ok: false, code: "table_not_configured", message: `尚未配置 ${tableName} 数据表 ID。`
  }, 400);

  const url = new URL(request.url);
  const rawSize = Number(url.searchParams.get("page_size") || 50);
  try {
    const data = await listRecords(env, tableId, {
      pageSize: Number.isFinite(rawSize) ? rawSize : 50,
      pageToken: url.searchParams.get("page_token") || undefined,
      keyword: url.searchParams.get("keyword") || undefined
    });
    return json({
      ok: true, items: data.items || [], total: data.total ?? null,
      hasMore: data.has_more ?? false, pageToken: data.page_token ?? null
    });
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : "读取记录失败。" }, 502);
  }
}

export async function handleCreate(request: Request, env: Env, tableName: TableName): Promise<Response> {
  const tableId = getTableId(env, tableName);
  if (!tableId) return json({ ok: false, message: `尚未配置 ${tableName} 数据表 ID。` }, 400);
  try {
    const body = await readJson(request);
    if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
      return json({ ok: false, message: "fields 必须是 JSON 对象。" }, 400);
    }
    const record = await createRecord(env, tableId, body.fields as Record<string, unknown>);
    return json({ ok: true, record }, 201);
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : "创建记录失败。" }, 502);
  }
}

export async function handleUpdate(
  request: Request, env: Env, tableName: TableName, recordId: string
): Promise<Response> {
  const tableId = getTableId(env, tableName);
  if (!tableId) return json({ ok: false, message: `尚未配置 ${tableName} 数据表 ID。` }, 400);
  try {
    const body = await readJson(request);
    if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
      return json({ ok: false, message: "fields 必须是 JSON 对象。" }, 400);
    }
    const record = await updateRecord(env, tableId, recordId, body.fields as Record<string, unknown>);
    return json({ ok: true, record });
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : "更新记录失败。" }, 502);
  }
}