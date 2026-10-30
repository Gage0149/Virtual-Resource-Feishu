import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Search, RefreshCw, Pencil, ChevronRight } from "lucide-react";
import { api, displayValue } from "../lib/api";
import type { BitableRecord, RecordListResponse } from "../types";
import JsonRecordEditor from "../components/JsonRecordEditor";

export default function GenericRecords({
  kind, title, description
}: {
  kind: "publications" | "templates"; title: string; description: string;
}) {
  const [records, setRecords] = useState<BitableRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState("");
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<BitableRecord | null>(null);
  const [creating, setCreating] = useState(false);

  async function load(pageToken: string | null = null, search = applied) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page_size: "50" });
      if (pageToken) params.set("page_token", pageToken);
      if (search) params.set("keyword", search);
      const result = await api<RecordListResponse>(`/api/${kind}?${params}`);
      setRecords(result.items || []); setTotal(result.total);
      setNextToken(result.pageToken); setCurrentToken(pageToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败。"); setRecords([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(null, ""); }, [kind]);

  function submitSearch(event: FormEvent) {
    event.preventDefault(); setApplied(keyword); setPage(1); void load(null, keyword);
  }

  async function save(fields: Record<string, unknown>, id?: string) {
    await api(id ? `/api/${kind}/${encodeURIComponent(id)}` : `/api/${kind}`, {
      method: id ? "PATCH" : "POST", body: JSON.stringify({ fields })
    });
    setEditing(null); setCreating(false); await load(currentToken);
  }

  return (
    <div className="page">
      <div className="page-heading"><div><div className="eyebrow">CONTENT WORKSPACE</div>
        <h1>{title}</h1><p>{description}</p></div>
        <button className="button primary" onClick={() => setCreating(true)}><Plus size={16}/> 新增记录</button>
      </div>
      <section className="panel">
        <form className="toolbar" onSubmit={submitSearch}>
          <div className="search-box"><Search size={17}/><input value={keyword}
            onChange={(e) => setKeyword(e.target.value)} placeholder="搜索标题或内容…"/></div>
          <button className="button primary">搜索</button>
          <button type="button" className="icon-button" onClick={() => load(currentToken)}><RefreshCw size={17}/></button>
        </form>
        {error && <div className="error-panel">{error}</div>}
        <div className="table-meta"><span>{total === null ? `${records.length} 条` : `共 ${total} 条`}</span><span>第 {page} 页</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>标题 / 名称</th><th>平台 / 类型</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead>
          <tbody>
            {records.map((record) => {
              const f = record.fields || {};
              return <tr key={record.record_id}>
                <td className="title-cell">{displayValue(f["标题"] ?? f["名称"] ?? f["title"] ?? f["模板名称"])}</td>
                <td>{displayValue(f["发布平台"] ?? f["平台"] ?? f["platform"])}</td>
                <td>{displayValue(f["发布状态"] ?? f["状态"] ?? f["status"])}</td>
                <td>{record.last_modified_time ? new Date(record.last_modified_time).toLocaleString() : "—"}</td>
                <td><button className="icon-button" onClick={() => setEditing(record)}><Pencil size={16}/></button></td>
              </tr>;
            })}
            {!loading && records.length === 0 && <tr><td colSpan={5} className="empty-cell">没有记录，或尚未配置对应的数据表。</td></tr>}
            {loading && <tr><td colSpan={5} className="empty-cell">正在读取…</td></tr>}
          </tbody>
        </table></div>
        <div className="pagination"><span>使用飞书数据表作为唯一数据源</span>
          <div><button className="button secondary small" disabled={!currentToken || loading}
            onClick={() => { setPage(1); void load(null); }}>回到第一页</button>
            <button className="button secondary small" disabled={!nextToken || loading}
              onClick={() => { setPage((p) => p + 1); void load(nextToken); }}>下一页 <ChevronRight size={15}/></button></div>
        </div>
      </section>
      {editing && <JsonRecordEditor title={`编辑记录 · ${editing.record_id}`} initialFields={editing.fields}
        onSave={(fields) => save(fields, editing.record_id)} onClose={() => setEditing(null)}/>}
      {creating && <JsonRecordEditor title="新增记录" initialFields={{"标题": "", "正文": "", "发布状态": "draft"}}
        onSave={(fields) => save(fields)} onClose={() => setCreating(false)}/>}
    </div>
  );
}