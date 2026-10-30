import { useState } from "react";
import type { FormEvent } from "react";
import { LockKeyhole, Boxes, UserRound } from "lucide-react";
import { api } from "../lib/api";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败。");
    } finally { setBusy(false); }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark"><Boxes size={25} /></div>
        <h1>资源管理工作台</h1>
        <p>私人管理后台 · 请验证身份后继续</p>

        <label className="field-label" htmlFor="username">登录用户名</label>
        <div className="password-wrap">
          <UserRound size={17} />
          <input id="username" type="text" autoComplete="username"
            value={username} onChange={(event) => setUsername(event.target.value)}
            placeholder="输入登录用户名" maxLength={128} required />
        </div>

        <label className="field-label" htmlFor="password">登录密码</label>
        <div className="password-wrap">
          <LockKeyhole size={17} />
          <input id="password" type="password" autoComplete="current-password"
            value={password} onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入至少 6 位密码" minLength={6} maxLength={128} required />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="button primary full-width" disabled={busy}>
          {busy ? "验证中…" : "登录"}
        </button>
        <small>登录密码不少于 6 位。请勿在公共设备上保存登录状态。</small>
      </form>
    </main>
  );
}
