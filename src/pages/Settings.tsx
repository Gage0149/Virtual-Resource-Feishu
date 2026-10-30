import { useState } from "react";
import { CheckCircle2, CircleAlert, RefreshCw, Database, Table2, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";

interface TestResult {
  ok: boolean; stage?: string; message?: string; sampleCount?: number;
  total?: number | null; hasMore?: boolean; fieldNames?: string[]; missing?: string[];
}

export default function Settings() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [tables, setTables] = useState<unknown>(null);
  const [fields, setFields] = useState<unknown>(null);
  const [busy, setBusy] = useState("");

  async function test() {
    setBusy("test");
    try { setResult(await api<TestResult>("/api/feishu/test")); }
    catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : "连接失败。" }); }
    finally { setBusy(""); }
  }
  async function loadTables() {
    setBusy("tables");
    try { const data = await api<{data: unknown}>("/api/feishu/tables"); setTables(data.data); }
    catch (error) { setTables({error: error instanceof Error ? error.message : "读取失败"}); }
    finally { setBusy(""); }
  }
  async function loadFields() {
    setBusy("fields");
    try { const data = await api<{data: unknown}>("/api/feishu/fields?table=resources"); setFields(data.data); }
    catch (error) { setFields({error: error instanceof Error ? error.message : "读取失败"}); }
    finally { setBusy(""); }
  }

  return (
    <div className="page">
      <div className="page-heading"><div><div className="eyebrow">CONFIGURATION</div>
        <h1>连接与设置</h1><p>检查飞书自建应用与多维表格的服务端连接。</p></div></div>
      <section className="panel settings-panel">
        <div className="panel-heading"><div><h2><ShieldCheck size={19}/> 安全配置</h2>
          <p>密钥只保存在 Cloudflare 服务端，不会显示在此页面。</p></div></div>
        <div className="settings-grid">
          <div><span>飞书 App ID</span><strong>服务端配置，由连接测试验证</strong></div>
          <div><span>飞书 App Secret</span><strong>仅服务端 Secret 可读取</strong></div>
          <div><span>管理员登录</span><strong>HttpOnly 签名会话 Cookie</strong></div>
          <div><span>数据存储</span><strong>飞书多维表格（唯一数据源）</strong></div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2><Database size={19}/> 飞书连接测试</h2>
          <p>最多读取 5 条记录，仅返回字段名称和计数，不返回资源内容。</p></div>
          <button className="button primary" onClick={test} disabled={busy === "test"}>
            <RefreshCw size={16} className={busy === "test" ? "spin" : ""}/> 开始测试</button></div>
        {result && <div className={`connection-result ${result.ok ? "success" : "failure"}`}>
          {result.ok ? <CheckCircle2 size={20}/> : <CircleAlert size={20}/>}
          <div><strong>{result.ok ? "连接成功" : "连接失败"}</strong><p>{result.message}</p>
            {result.missing && <p>缺少配置：{result.missing.join(", ")}</p>}
            {result.ok && <p>样本记录：{result.sampleCount} · 总记录：{result.total ?? "未知"} · 更多记录：{result.hasMore ? "是" : "否"}</p>}
            {result.fieldNames && <p>字段：{result.fieldNames.join("、") || "首条记录没有字段"}</p>}</div>
        </div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2><Table2 size={19}/> 数据表与字段</h2>
          <p>读取飞书中当前应用有权限访问的数据表结构。</p></div>
          <div className="button-row">
            <button className="button secondary" onClick={loadTables} disabled={busy === "tables"}>读取数据表</button>
            <button className="button secondary" onClick={loadFields} disabled={busy === "fields"}>读取资源字段</button>
          </div></div>
        {tables !== null && <pre className="result-json">{JSON.stringify(tables, null, 2)}</pre>}
        {fields !== null && <pre className="result-json">{JSON.stringify(fields, null, 2)}</pre>}
      </section>
      <div className="notice">如果读取失败，请确认飞书应用已启用、已开通多维表格权限，并且已被添加到目标多维表格。不要把 App Secret 填入网页。</div>
    </div>
  );
}