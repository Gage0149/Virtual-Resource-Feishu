import { useState } from "react";
import { Save } from "lucide-react";
import Modal from "./Modal";

export default function JsonRecordEditor({
  title, initialFields, onSave, onClose
}: {
  title: string;
  initialFields: Record<string, unknown>;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(JSON.stringify(initialFields, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { setError("JSON 格式不正确，请检查逗号、引号和括号。"); return; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("字段内容必须是 JSON 对象。"); return;
    }
    setSaving(true);
    try { await onSave(parsed as Record<string, unknown>); }
    catch (err) { setError(err instanceof Error ? err.message : "保存失败。"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="modal-body">
        <div className="notice">
          这是飞书原始字段 JSON 编辑器。请保留字段名称及数据结构。单选、多选、日期和附件字段必须符合飞书 API 的字段格式。
        </div>
        <textarea className="json-editor" spellCheck={false} value={value}
          onChange={(event) => setValue(event.target.value)} />
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>取消</button>
          <button className="button primary" onClick={submit} disabled={saving}>
            <Save size={16} /> {saving ? "保存中…" : "保存到飞书"}
          </button>
        </div>
      </div>
    </Modal>
  );
}