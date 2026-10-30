import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Search, RefreshCw, Pencil, ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import { api, displayValue, fieldValue, hasValue } from "../lib/api";
import type { BitableRecord, RecordListResponse } from "../types";
import JsonRecordEditor from "../components/JsonRecordEditor";

const PAGE_SIZE = 50;

export default function Resources({ linksOnly = false }: { linksOnly?: boolean }) {
  const [records, setRecords] = useState<BitableRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [pageTokens, setPageTokens] = useState<string[]>([""]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<BitableRecord | null>(null);
  const [creating, setCreating] = useState(false);

  async function load(index = pageIndex, search = appliedKeyword, tokens = pageTokens) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page_size: String(PAGE_SIZE) });
      if (tokens[index]) params.set("page_token", tokens[index]);
      if (search.trim()) params.set("keyword", search.trim());
      const result = await api<RecordListResponse>(`/api/resources?${params.toString()}`);
      setRecords(result.items || []);
      setHasMore(result.hasMore);
      setTotal(result.total);
      if (result.pageToken && !tokens[index + 1]) {
        setPageTokens((current) => {
          const next = [...current]; next[index + 1] = result.pageToken!; return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取资源失败。");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(0, "", [""]); }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    const tokens = [""];
    setAppliedKeyword(keyword); setPageTokens(tokens); setPageIndex(0);
    void load(0, keyword, tokens);
  }

  async function save(fields: Record<string, unknown>, recordId?: string) {
    await api(recordId ? `/api/resources/${encodeURIComponent(recordId)}` : "/api/resources", {
      method: recordId ? "PATCH" : "POST", body: JSON.stringify({ fields })
    });
    setEditing(null); setCreating(false); await load();
  }

  function goPrevious() {
    const next = Math.max(0, pageIndex - 1); setPageIndex(next); void load(next);
  }
  function goNext() {
    const next = pageIndex + 1;
    if (!pageTokens[next]) return;
    setPageIndex(next); void load(next);
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div><div className="eyebrow">{linksOnly ? "LINK CENTER" : "RESOURCE LIBRARY"}</div>
          <h1>{linksOnly ? "链接维护" : "资源库"}</h1>
          <p>{linksOnly ? "检查资源对应的百度网盘、夸克网盘链接及状态。" : "直接浏览和编辑飞书多维表格中的资源记录。"}</p></div>
        <button className="button primary" onClick={() => setCreating(true)}><Plus size={16}/> 新增资源</button>
      </div>
      <section className="panel">
        <form className="toolbar" onSubmit={search}>
          <div className="search-box"><Search size={17}/><input value={keyword}
            onChange={(event) => setKeyword(event.target.value)} placeholder="搜索资源名称、编号或简介…"/></div>
          <button className="button primary" type="submit">搜索</button>
          <button className="button secondary" type="button" onClick={() => {
            setKeyword(""); setAppliedKeyword(""); setPageTokens([""]); setPageIndex(0);
            void load(0, "", [""]);
          }}>重置</button>
          <div className="toolbar-spacer"/>
          <button className="icon-button" type="button" onClick={() => load()} title="刷新">
            <RefreshCw size={17} className={loading ? "spin" : ""}/>
          </button>
        </form>
        {error && <div className="error-panel">{error}</div>}
        <div className="table-meta"><span>{total === null ? `当前页 ${records.length} 条` : `共 ${total} 条记录`}</span>
          <span>每页 {PAGE_SIZE} 条 · 第 {pageIndex + 1} 页</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>资源编号</th><th>资源名称</th><th>分类</th><th>标签</th>
              {linksOnly && <><th>百度网盘</th><th>夸克网盘</th><th>链接状态</th></>}
              {!linksOnly && <th>最近修改</th>}<th>操作</th></tr></thead>
            <tbody>
              {loading && records.length === 0 && <tr><td colSpan={linksOnly ? 8 : 6} className="empty-cell">正在读取飞书数据…</td></tr>}
              {!loading && records.length === 0 && <tr><td colSpan={linksOnly ? 8 : 6} className="empty-cell">没有找到记录。</td></tr>}
              {records.map((record) => {
                const fields = record.fields || {};
                const code = fieldValue(fields, ["资源编号", "编号", "resource_code"]);
                const title = fieldValue(fields, ["资源名称", "名称", "title"]);
                const category = fieldValue(fields, ["资源分类", "分类", "category"]);
                const tags = fieldValue(fields, ["标签", "tags"]);
                const baidu = fieldValue(fields, ["百度网盘链接", "百度链接", "baidu"]);
                const quark = fieldValue(fields, ["夸克网盘链接", "夸克链接", "quark"]);
                const status = fieldValue(fields, ["网盘链接状态", "链接状态", "link_status"]);
                return <tr key={record.record_id}>
                  <td className="code-cell">{displayValue(code)}</td>
                  <td className="title-cell">{displayValue(title)}</td>
                  <td>{displayValue(category)}</td><td><span className="tag-text">{displayValue(tags)}</span></td>
                  {linksOnly && <>
                    <td><span className={hasValue(baidu) ? "presence yes" : "presence"}>{hasValue(baidu) ? "已配置" : "未配置"}</span></td>
                    <td><span className={hasValue(quark) ? "presence yes" : "presence"}>{hasValue(quark) ? "已配置" : "未配置"}</span></td>
                    <td>{displayValue(status)}</td>
                  </>}
                  {!linksOnly && <td>{record.last_modified_time ? new Date(record.last_modified_time).toLocaleString() : "—"}</td>}
                  <td><button className="icon-button edit-button" onClick={() => setEditing(record)} title="编辑字段"><Pencil size={16}/></button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="pagination"><span>当前显示 {records.length} 条</span>
          <div>
            <button className="button secondary small" onClick={goPrevious} disabled={pageIndex === 0 || loading}><ChevronLeft size={15}/> 上一页</button>
            <button className="button secondary small" onClick={goNext} disabled={!hasMore || loading}>下一页 <ChevronRight size={15}/></button>
          </div>
        </div>
      </section>
      {editing && <JsonRecordEditor title={`编辑资源 · ${editing.record_id}`} initialFields={editing.fields}
        onSave={(fields) => save(fields, editing.record_id)} onClose={() => setEditing(null)}/>}
      {creating && <JsonRecordEditor title="新增资源" initialFields={{ "资源名称": "" }} onSave={(fields) => save(fields)} onClose={() => setCreating(false)}/>}
      {linksOnly && <div className="inline-hint"><Link2 size={15}/> 列表不会直接显示完整分享地址。点击编辑可查看和修改字段。</div>}
    </div>
  );
}