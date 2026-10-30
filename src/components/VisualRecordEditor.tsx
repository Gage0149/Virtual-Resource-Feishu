import { useEffect, useMemo, useState } from "react";
import { Save, Upload, X, Image as ImageIcon, FileText, CheckCircle2, ChevronDown, AlertCircle } from "lucide-react";
import Modal from "./Modal";
import { api, displayValue } from "../lib/api";

interface BitableField {
  field_id?: string;
  field_name: string;
  type: number;
  property?: { options?: unknown[]; [key: string]: unknown };
  is_primary?: boolean;
}
interface AttachmentItem {
  file_token?: string; name?: string; size?: number; type?: string;
  url?: string; tmp_url?: string; [key: string]: unknown;
}
type FieldGroupName = "基础信息" | "网盘链接" | "发布管理" | "其他信息";

const FALLBACK_FIELDS: BitableField[] = [
  { field_name: "资源编号", type: 1 },
  { field_name: "资源名称", type: 1, is_primary: true },
  { field_name: "资源分类", type: 3 },
  { field_name: "标签", type: 4 },
  { field_name: "资源简介", type: 1 },
  { field_name: "资源封面", type: 17 },
  { field_name: "百度网盘链接", type: 1 },
  { field_name: "夸克网盘链接", type: 1 },
  { field_name: "网盘链接状态", type: 4 },
  { field_name: "🍠小红书", type: 3 },
  { field_name: "🐟咸鱼", type: 3 },
  { field_name: "✖︎ Twitter", type: 3 },
  { field_name: "微信公众号", type: 3 }
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function inferType(name: string, value: unknown): number {
  if (Array.isArray(value)) {
    if (value.some((item) => isObject(item) && ("file_token" in item || "tmp_url" in item))) return 17;
    return 4;
  }
  if (isObject(value) && ("link" in value || "text" in value)) return 15;
  if (typeof value === "boolean") return 7;
  if (typeof value === "number") return /日期|时间/.test(name) ? 5 : 2;
  return 1;
}
function fallbackDefinitions(initialFields: Record<string, unknown>): BitableField[] {
  const byName = new Map<string, BitableField>();
  for (const field of FALLBACK_FIELDS) byName.set(field.field_name, field);
  for (const [name, value] of Object.entries(initialFields)) {
    if (!byName.has(name)) byName.set(name, { field_name: name, type: inferType(name, value) });
  }
  return Array.from(byName.values());
}
function normalizeDefinitions(raw: unknown): BitableField[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (isObject(raw)) {
    if (Array.isArray(raw.items)) list = raw.items;
    else if (Array.isArray(raw.fields)) list = raw.fields;
    else if (isObject(raw.data)) {
      if (Array.isArray(raw.data.items)) list = raw.data.items;
      else if (Array.isArray(raw.data.fields)) list = raw.data.fields;
    }
  }
  return list.filter(isObject).map((item) => ({
    field_id: typeof item.field_id === "string" ? item.field_id : undefined,
    field_name: String(item.field_name ?? item.name ?? ""),
    type: Number(item.type ?? item.field_type ?? 1),
    property: isObject(item.property) ? item.property as BitableField["property"] : {},
    is_primary: Boolean(item.is_primary)
  })).filter((field) => field.field_name);
}
function optionsFor(field: BitableField): string[] {
  const raw = field.property?.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((option) => {
    if (typeof option === "string") return option;
    if (isObject(option)) return String(option.name ?? option.text ?? option.value ?? "");
    return "";
  }).filter(Boolean);
}
function isEditable(field: BitableField): boolean {
  return [1, 2, 3, 4, 5, 7, 13, 15, 17].includes(field.type);
}
function groupFor(name: string): FieldGroupName {
  if (/百度|夸克|网盘|提取码|链接密码|分享密码|链接状态/.test(name)) return "网盘链接";
  if (/小红书|咸鱼|闲鱼|Twitter|推特|公众号|微信|发布|文案|平台|渠道/.test(name)) return "发布管理";
  if (/资源编号|资源名称|分类|标签|简介|封面|资源类型|来源/.test(name)) return "基础信息";
  return "其他信息";
}
function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}
function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (isObject(item)) return String(item.name ?? item.text ?? item.value ?? "");
    return "";
  }).filter(Boolean);
}
function attachmentsOf(value: unknown): AttachmentItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((item) => item as AttachmentItem);
}
function attachmentPreview(item: AttachmentItem): string {
  const token = typeof item.file_token === "string" ? item.file_token : "";
  const candidates = [item.url, item.tmp_url];
  let extra = "";
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if (url.hostname === "open.feishu.cn") extra = url.searchParams.get("extra") || extra;
      else return candidate;
    } catch { /* ignore malformed attachment URLs */ }
  }
  if (!token) return "";
  return "/api/feishu/attachments/" + encodeURIComponent(token) + (extra ? "?extra=" + encodeURIComponent(extra) : "");
}
function dateInputValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const timestamp = typeof value === "number" ? value : Number(value);
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function isLongText(field: BitableField, value: unknown): boolean {
  return /简介|文案|正文|内容|备注|描述|说明|详情|原文/.test(field.field_name)
    || (typeof value === "string" && (value.includes("\n") || value.length > 100));
}

export default function VisualRecordEditor({
  title, initialFields, onSave, onClose
}: {
  title: string;
  initialFields: Record<string, unknown>;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [definitions, setDefinitions] = useState<BitableField[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaFallback, setSchemaFallback] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({ ...initialFields });
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [pendingUploads, setPendingUploads] = useState<Record<string, File[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ data: unknown }>("/api/feishu/fields?table=resources")
      .then((result) => {
        const parsed = normalizeDefinitions(result.data);
        if (!active) return;
        if (parsed.length) setDefinitions(parsed);
        else {
          setDefinitions(fallbackDefinitions(initialFields));
          setSchemaFallback(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setDefinitions(fallbackDefinitions(initialFields));
        setSchemaFallback(true);
      })
      .finally(() => { if (active) setSchemaLoading(false); });
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => {
    const names: FieldGroupName[] = ["基础信息", "网盘链接", "发布管理", "其他信息"];
    return names.map((name) => ({
      name,
      fields: definitions.filter((field) => isEditable(field) && groupFor(field.field_name) === name)
    })).filter((group) => group.fields.length > 0);
  }, [definitions]);
  const readOnlyFields = useMemo(() => definitions.filter((field) => !isEditable(field)), [definitions]);

  function updateValue(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }));
    setDirty((current) => ({ ...current, [name]: true }));
    setError("");
  }
  function updatePendingFiles(name: string, files: File[]) {
    setPendingUploads((current) => ({ ...current, [name]: files }));
    setDirty((current) => ({ ...current, [name]: true }));
    setError("");
  }

  function renderField(field: BitableField) {
    const name = field.field_name;
    const value = values[name];
    const options = optionsFor(field);
    const inputId = "visual-field-" + (field.field_id || name.replace(/[^a-zA-Z0-9_-]/g, "-"));
    const required = Boolean(field.is_primary) || name === "资源名称";
    const label = <label className="visual-field-label" htmlFor={inputId}>
      {name}{required && <span className="visual-required"> *</span>}
    </label>;

    let control;
    if (field.type === 1 || field.type === 13) {
      const text = stringValue(value);
      const longText = isLongText(field, value);
      control = longText
        ? <textarea id={inputId} className="visual-textarea" rows={4} value={text}
            placeholder={"请输入" + name} onChange={(event) => updateValue(name, event.target.value)} />
        : <input id={inputId} className="visual-input" type="text" value={text}
            placeholder={"请输入" + name} onChange={(event) => updateValue(name, event.target.value)} />;
    } else if (field.type === 2) {
      control = <input id={inputId} className="visual-input" type="number" step="any"
        value={value === null || value === undefined ? "" : String(value)}
        placeholder="请输入数字" onChange={(event) => updateValue(name, event.target.value === "" ? "" : Number(event.target.value))} />;
    } else if (field.type === 3) {
      const selected = stringValue(value);
      control = <>
        <input id={inputId} className="visual-input" list={inputId + "-options"} value={selected}
          placeholder="选择或输入选项" onChange={(event) => updateValue(name, event.target.value)} />
        <datalist id={inputId + "-options"}>
          {options.map((option) => <option key={option} value={option} />)}
        </datalist>
      </>;
    } else if (field.type === 4) {
      const selected = stringArray(value);
      const known = options.filter((option) => selected.includes(option));
      const custom = selected.filter((item) => !options.includes(item));
      control = <div className="visual-multi-control">
        {options.length > 0 && <div className="visual-option-list">
          {options.map((option) => (
            <label className={"visual-option " + (selected.includes(option) ? "selected" : "")} key={option}>
              <input type="checkbox" checked={selected.includes(option)} onChange={(event) => {
                const next = event.target.checked ? [...selected, option] : selected.filter((item) => item !== option);
                updateValue(name, next);
              }} />
              <span>{option}</span>
            </label>
          ))}
        </div>}
        <input id={inputId} className="visual-input" type="text"
          value={custom.join("，")} placeholder={options.length ? "其他自定义选项，用逗号分隔" : "多个选项用逗号分隔"}
          onChange={(event) => {
            const customNext = event.target.value.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean);
            updateValue(name, [...known, ...customNext]);
          }} />
      </div>;
    } else if (field.type === 5) {
      control = <input id={inputId} className="visual-input" type="datetime-local"
        value={dateInputValue(value)} onChange={(event) => updateValue(name, event.target.value)} />;
    } else if (field.type === 7) {
      control = <label className="visual-switch">
        <input id={inputId} type="checkbox" checked={value === true}
          onChange={(event) => updateValue(name, event.target.checked)} />
        <span className="visual-switch-track" /><span>{value === true ? "已启用" : "未启用"}</span>
      </label>;
    } else if (field.type === 15) {
      const linkValue = isObject(value) ? value : {};
      control = <div className="visual-link-control">
        <input className="visual-input" type="text" value={String(linkValue.text ?? "")}
          placeholder="链接显示文字" onChange={(event) => updateValue(name, { ...linkValue, text: event.target.value })} />
        <input className="visual-input" type="url" value={String(linkValue.link ?? "")}
          placeholder="https://..." onChange={(event) => updateValue(name, { ...linkValue, link: event.target.value })} />
      </div>;
    } else if (field.type === 17) {
      const attachments = attachmentsOf(value);
      const pending = pendingUploads[name] || [];
      control = <div className="visual-attachment-control">
        {attachments.length > 0 && <div className="visual-attachment-list">
          {attachments.map((item, index) => {
            const preview = attachmentPreview(item);
            return <div className="visual-attachment-item" key={(item.file_token || item.name || "attachment") + "-" + index}>
              {preview && String(item.type || "").startsWith("image/")
                ? <img src={preview} alt={String(item.name || "附件")} onError={(event) => { event.currentTarget.style.display = "none"; }} />
                : <span className="visual-attachment-icon"><FileText size={18} /></span>}
              <span className="visual-attachment-name" title={String(item.name || "附件")}>{String(item.name || "附件")}</span>
              <button type="button" className="visual-remove-button" title="移除此附件"
                onClick={() => updateValue(name, attachments.filter((_, itemIndex) => itemIndex !== index))}>
                <X size={14} />
              </button>
            </div>;
          })}
        </div>}
        {pending.length > 0 && <div className="visual-pending-files">
          {pending.map((file, index) => <div className="visual-pending-file" key={file.name + "-" + index}>
            <span><Upload size={13} /> 待上传：{file.name}</span>
            <button type="button" onClick={() => updatePendingFiles(name, pending.filter((_, itemIndex) => itemIndex !== index))}><X size={13}/></button>
          </div>)}
        </div>}
        <label className="visual-upload-button">
          <Upload size={15} /> 添加{name.includes("封面") ? "封面图片" : "附件"}
          <input type="file" multiple accept={name.includes("封面") ? "image/*" : undefined}
            onChange={(event) => {
              const selected = Array.from(event.currentTarget.files || []);
              const tooLarge = selected.find((file) => file.size > 20 * 1024 * 1024);
              if (tooLarge) setError(tooLarge.name + " 超过 20MB，当前版本暂不支持单次上传大于 20MB 的文件。");
              else if (selected.length) updatePendingFiles(name, [...pending, ...selected]);
              event.currentTarget.value = "";
            }} />
        </label>
        <span className="visual-help-text">附件会在点击保存时上传到飞书；单个文件最大 20MB。</span>
      </div>;
    } else {
      control = <div className="visual-readonly-value">{displayValue(value)}</div>;
    }

    const wide = field.type === 17 || isLongText(field, value) || field.type === 15;
    return <div className={"visual-field " + (wide ? "visual-field-wide" : "")} key={field.field_id || name}>
      {label}{control}
    </div>;
  }

  async function uploadAttachment(file: File): Promise<AttachmentItem> {
    const form = new FormData();
    form.append("file", file, file.name);
    const response = await fetch("/api/feishu/upload", {
      method: "POST", body: form, credentials: "same-origin", cache: "no-store"
    });
    const result = await response.json().catch(() => ({})) as {
      ok?: boolean; message?: string; attachment?: { file_token?: string }
    };
    if (!response.ok || !result.attachment?.file_token) {
      throw new Error(result.message || ("上传 " + file.name + " 失败。"));
    }
    return { file_token: result.attachment.file_token, name: file.name, size: file.size, type: file.type };
  }

  async function submit() {
    setError("");
    const nameField = definitions.find((field) => field.field_name === "资源名称") || definitions.find((field) => field.is_primary && isEditable(field));
    if (nameField && !stringValue(values[nameField.field_name]).trim()) {
      setError("请填写必填字段「" + nameField.field_name + "」。");
      return;
    }
    const changedNames = Object.keys(dirty).filter((name) => dirty[name]);
    if (!changedNames.length) {
      setError("还没有修改内容。请修改字段后再保存。");
      return;
    }

    setSaving(true);
    try {
      const changed: Record<string, unknown> = {};
      for (const name of changedNames) {
        const field = definitions.find((item) => item.field_name === name);
        if (!field || !isEditable(field)) continue;
        const value = values[name];

        if (field.type === 17) {
          const existing = attachmentsOf(value)
            .filter((item) => typeof item.file_token === "string")
            .map((item) => ({ file_token: String(item.file_token) }));
          const uploaded: { file_token: string }[] = [];
          for (const file of pendingUploads[name] || []) {
            const attachment = await uploadAttachment(file);
            if (attachment.file_token) uploaded.push({ file_token: attachment.file_token });
          }
          changed[name] = [...existing, ...uploaded];
        } else if (field.type === 5) {
          changed[name] = value ? new Date(String(value)).getTime() : null;
        } else if (field.type === 2) {
          changed[name] = value === "" || value === null || value === undefined ? null : Number(value);
        } else if (field.type === 4) {
          changed[name] = stringArray(value);
        } else if (field.type === 7) {
          changed[name] = value === true;
        } else if (field.type === 15) {
          const linkValue = isObject(value) ? value : {};
          changed[name] = { text: String(linkValue.text ?? ""), link: String(linkValue.link ?? "") };
        } else {
          changed[name] = value === null || value === undefined ? "" : value;
        }
      }
      if (!Object.keys(changed).length) {
        setError("没有可保存的字段。请检查飞书字段类型。");
        return;
      }
      await onSave(changed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="visual-editor">
        <div className="visual-editor-scroll">
          <div className="visual-editor-intro">
            <div className="visual-editor-intro-icon"><CheckCircle2 size={18}/></div>
            <div><strong>可视化编辑</strong><p>直接修改资源信息，保存后写回飞书多维表格。没有修改的字段不会被覆盖。</p></div>
          </div>
          {schemaLoading && <div className="visual-editor-status">正在读取飞书字段定义…</div>}
          {schemaFallback && !schemaLoading && <div className="visual-editor-warning">
            未能读取字段定义，当前使用常见资源字段生成表单。建议检查「连接与设置」中的字段读取权限。
          </div>}
          {groups.map((group) => (
            <section className="visual-editor-section" key={group.name}>
              <header><div><h3>{group.name}</h3><span>{group.fields.length} 个字段</span></div></header>
              <div className="visual-editor-grid">{group.fields.map(renderField)}</div>
            </section>
          ))}
          {readOnlyFields.length > 0 && <details className="visual-readonly-section">
            <summary><span>系统字段 / 暂不支持编辑</span><span>{readOnlyFields.length} 个字段 <ChevronDown size={14}/></span></summary>
            <div className="visual-readonly-list">
              {readOnlyFields.map((field) => (
                <div key={field.field_id || field.field_name}>
                  <span>{field.field_name}</span><strong>{displayValue(values[field.field_name])}</strong>
                </div>
              ))}
            </div>
            <p>这些字段由飞书自动计算或属于暂未支持的复杂类型，网页不会修改它们。</p>
          </details>}
          {error && <div className="visual-editor-error"><AlertCircle size={16}/>{error}</div>}
        </div>
        <footer className="visual-editor-footer">
          <span>数据直接保存至飞书 · 未修改字段保持原样</span>
          <div>
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>取消</button>
            <button type="button" className="button primary" onClick={submit} disabled={saving || schemaLoading}>
              <Save size={15}/>{saving ? "保存中…" : "保存到飞书"}
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
