import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Plus, Search, RefreshCw, Pencil, ChevronLeft, ChevronRight, Link2,
  LayoutGrid, List, BookOpen, Camera, Gamepad2, Sparkles, GraduationCap,
  Palette, Package, Image as ImageIcon
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, displayValue, fieldValue, hasValue } from "../lib/api";
import type { BitableRecord, RecordListResponse } from "../types";
import JsonRecordEditor from "../components/JsonRecordEditor";

const PAGE_SIZE = 50;
type ViewMode = "gallery" | "table";

function attachmentUrl(value: unknown): string | null {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) return candidate;
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as Record<string, unknown>;
    for (const key of ["tmp_url", "url", "preview_url", "thumbnail_url", "download_url", "file_url"]) {
      const possible = item[key];
      if (typeof possible === "string" && /^https?:\/\//i.test(possible)) return possible;
    }
  }
  return null;
}

function categoryVisual(category: string): { theme: string; Icon: LucideIcon } {
  const value = category.toLowerCase();
  if (value.includes("摄影") || value.includes("图片") || value.includes("素材") || value.includes("视频")) {
    return { theme: "visual", Icon: Camera };
  }
  if (value.includes("游戏")) return { theme: "game", Icon: Gamepad2 };
  if (value.includes("ai")) return { theme: "ai", Icon: Sparkles };
  if (value.includes("教程") || value.includes("学习")) return { theme: "learning", Icon: GraduationCap };
  if (value.includes("书籍")) return { theme: "book", Icon: BookOpen };
  if (value.includes("模版") || value.includes("模板")) return { theme: "template", Icon: Palette };
  return { theme: "other", Icon: Package };
}

function tagItems(value: unknown): string[] {
  if (!hasValue(value)) return [];
  return displayValue(value).split(/[、,，]/).map((item) => item.trim()).filter((item) => item && item !== "—");
}

function ResourceCard({ record, onEdit }: { record: BitableRecord; onEdit: () => void }) {
  const fields = record.fields || {};
  const code = displayValue(fieldValue(fields, ["资源编号", "编号", "resource_code"]));
  const title = displayValue(fieldValue(fields, ["资源名称", "名称", "title"]));
  const category = displayValue(fieldValue(fields, ["资源分类", "分类", "category"]));
  const description = displayValue(fieldValue(fields, ["资源简介", "简介", "description"]));
  const tags = tagItems(fieldValue(fields, ["标签", "tags"]));
  const cover = attachmentUrl(fieldValue(fields, ["资源封面", "封面", "cover"]));
  const baidu = fieldValue(fields, ["百度网盘链接", "百度链接", "baidu"]);
  const quark = fieldValue(fields, ["夸克网盘链接", "夸克链接", "quark"]);
  const linkStatus = displayValue(fieldValue(fields, ["网盘链接状态", "链接状态", "link_status"]));
  const platforms = [
    { label: "小红书", value: fieldValue(fields, ["🍠小红书", "小红书"]) },
    { label: "闲鱼", value: fieldValue(fields, ["🐟咸鱼", "咸鱼", "闲鱼"]) },
    { label: "X", value: fieldValue(fields, ["✖︎ Twitter", "Twitter", "X"]) }
  ].filter((item) => hasValue(item.value));
  const { theme, Icon } = categoryVisual(category);
  const updated = record.last_modified_time
    ? new Date(record.last_modified_time).toLocaleDateString()
    : "尚无修改时间";

  return (
    <article className="resource-card">
      <div className={`resource-card-cover cover-${theme}`}>
        <div className="cover-art" aria-hidden="true">
          <div className="cover-art-glow" />
          <Icon size={42} strokeWidth={1.35} />
          <div className="cover-art-copy">
            <span>FEISHU RESOURCE</span>
            <strong>{category === "—" ? "未分类资源" : category}</strong>
          </div>
        </div>
        {cover && <img className="resource-cover-image" src={cover} alt={title === "—" ? "资源封面" : title}
          loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
        <span className="resource-cover-code">{code}</span>
        {!cover && <span className="cover-empty-label"><ImageIcon size={12} /> 可在飞书添加封面</span>}
      </div>

      <div className="resource-card-body">
        <div className="resource-card-kicker">
          <span className={`resource-category category-${theme}`}>{category === "—" ? "未分类" : category}</span>
          <span className="resource-card-code">{code}</span>
        </div>
        <h3 title={title}>{title === "—" ? "未命名资源" : title}</h3>
        <p className="resource-card-description">{description === "—" ? "暂无资源简介。可以在编辑中补充内容说明。" : description}</p>

        <div className="resource-card-tags">
          {tags.length > 0 ? tags.slice(0, 4).map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>) : <span className="muted-tag">暂无标签</span>}
          {tags.length > 4 && <span className="more-tags">+{tags.length - 4}</span>}
        </div>

        <div className="resource-card-data">
          <div className="resource-link-row">
            <span className={`resource-link-pill ${hasValue(baidu) ? "available" : "unavailable"}`}>
              <Link2 size={12} /> 百度网盘
            </span>
            <span className={`resource-link-pill ${hasValue(quark) ? "available" : "unavailable"}`}>
              <Link2 size={12} /> 夸克网盘
            </span>
          </div>
          {linkStatus !== "—" && <div className="resource-link-status">链接状态：{linkStatus}</div>}
          <div className="resource-platform-row">
            {platforms.length > 0 ? platforms.map((item) => (
              <span className="platform-status" key={item.label}><b>{item.label}</b>{displayValue(item.value)}</span>
            )) : <span className="platform-status muted-platform">发布状态暂未填写</span>}
          </div>
        </div>

        <div className="resource-card-footer">
          <span>{updated}</span>
          <button className="button secondary small" onClick={onEdit}><Pencil size={13} /> 编辑资源</button>
        </div>
      </div>
    </article>
  );
}

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
  const [viewMode, setViewMode] = useState<ViewMode>("gallery");

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

  const tableView = (
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
  );

  return (
    <div className="page">
      <div className="page-heading">
        <div><div className="eyebrow">{linksOnly ? "LINK CENTER" : "RESOURCE LIBRARY"}</div>
          <h1>{linksOnly ? "链接维护" : "资源库"}</h1>
          <p>{linksOnly ? "检查资源对应的百度网盘、夸克网盘链接及状态。" : "以画廊卡片浏览资源，也可以切换回表格视图。"}</p></div>
        <button className="button primary" onClick={() => setCreating(true)}><Plus size={16}/> 新增资源</button>
      </div>
      <section className="panel resource-library-panel">
        <form className="toolbar" onSubmit={search}>
          <div className="search-box"><Search size={17}/><input value={keyword}
            onChange={(event) => setKeyword(event.target.value)} placeholder="搜索资源名称、编号或简介…"/></div>
          <button className="button primary" type="submit">搜索</button>
          <button className="button secondary" type="button" onClick={() => {
            setKeyword(""); setAppliedKeyword(""); setPageTokens([""]); setPageIndex(0);
            void load(0, "", [""]);
          }}>重置</button>
          <div className="toolbar-spacer"/>
          {!linksOnly && <div className="view-switch" aria-label="资源展示方式">
            <button type="button" className={viewMode === "gallery" ? "active" : ""} onClick={() => setViewMode("gallery")} title="卡片视图"><LayoutGrid size={15}/><span>卡片</span></button>
            <button type="button" className={viewMode === "table" ? "active" : ""} onClick={() => setViewMode("table")} title="表格视图"><List size={15}/><span>表格</span></button>
          </div>}
          <button className="icon-button" type="button" onClick={() => load()} title="刷新">
            <RefreshCw size={17} className={loading ? "spin" : ""}/>
          </button>
        </form>
        {error && <div className="error-panel">{error}</div>}
        <div className="table-meta"><span>{total === null ? `当前页 ${records.length} 条` : `共 ${total} 条资源`}</span>
          <span>每页 {PAGE_SIZE} 条 · 第 {pageIndex + 1} 页</span></div>

        {linksOnly || viewMode === "table" ? tableView : (
          <div className="resource-gallery-wrap">
            {loading && records.length === 0 && <div className="gallery-empty">正在读取飞书资源…</div>}
            {!loading && records.length === 0 && <div className="gallery-empty">没有找到资源，试试其他关键词。</div>}
            <div className="resource-gallery">
              {records.map((record) => <ResourceCard key={record.record_id} record={record} onEdit={() => setEditing(record)} />)}
            </div>
          </div>
        )}

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
