export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...init, headers, credentials: "same-origin", cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : `请求失败：HTTP ${response.status}`);
  }
  return data as T;
}

export function fieldValue(fields: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(fields, name)) return fields[name];
  }
  return undefined;
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return String(obj.text ?? obj.name ?? obj.link ?? "[对象]");
      }
      return String(item);
    }).join("、");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.text) return String(obj.text);
    if (obj.link) return "已配置链接";
    return JSON.stringify(value);
  }
  return String(value);
}

export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}