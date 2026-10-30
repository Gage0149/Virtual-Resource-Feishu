import { useEffect, useState } from "react";
import { LibraryBig, Link2, FileText, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

interface Summary {
  total: number | null; sampleCount: number; connectionOk: boolean; message: string;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true); setError("");
    try {
      const result = await api<{
        ok: boolean; total: number | null; sampleCount: number; message: string;
      }>("/api/feishu/test");
      setSummary({
        total: result.total, sampleCount: result.sampleCount,
        connectionOk: result.ok, message: result.message
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接检查失败。");
      setSummary(null);
    } finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="page">
      <div className="page-heading">
        <div><div className="eyebrow">OVERVIEW</div><h1>工作台</h1>
          <p>查看飞书资源库连接状态和数据概况。</p></div>
        <button className="button secondary" onClick={load} disabled={busy}>
          <RefreshCw size={16} className={busy ? "spin" : ""} /> 刷新
        </button>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon purple"><LibraryBig size={20}/></div>
          <span>资源记录总数</span><strong>{summary?.total ?? "—"}</strong><small>来自飞书资源总库</small></div>
        <div className="stat-card"><div className="stat-icon blue"><Link2 size={20}/></div>
          <span>连接测试样本</span><strong>{summary?.sampleCount ?? "—"}</strong><small>每次测试最多读取 5 条</small></div>
        <div className="stat-card"><div className="stat-icon green"><ShieldCheck size={20}/></div>
          <span>飞书连接状态</span><strong className="status-value">{summary?.connectionOk ? "正常" : "待检查"}</strong>
          <small>{summary?.message || "尚未完成连接测试"}</small></div>
        <div className="stat-card"><div className="stat-icon orange"><FileText size={20}/></div>
          <span>内容管理</span><strong>可选接入</strong><small>配置发布表 ID 后启用</small></div>
      </div>
      {error && <div className="error-panel">{error}</div>}
      <section className="panel">
        <div className="panel-heading"><div><h2>建议的使用流程</h2><p>先验证连接，再开始编辑真实资源。</p></div></div>
        <div className="steps-grid">
          <div className="step-card"><b>01</b><strong>检查飞书连接</strong><span>在设置页面检查应用凭证、表格 ID 和读取权限。</span></div>
          <div className="step-card"><b>02</b><strong>浏览资源总库</strong><span>通过分页、关键词和分类字段定位资源。</span></div>
          <div className="step-card"><b>03</b><strong>编辑并写回</strong><span>修改字段后保存，数据直接写回飞书。</span></div>
        </div>
      </section>
    </div>
  );
}