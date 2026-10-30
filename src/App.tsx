import { useEffect, useState } from "react";
import {
  LayoutDashboard, LibraryBig, Link2, NotebookPen, Files, Settings as SettingsIcon,
  LogOut, Menu, X, Boxes
} from "lucide-react";
import { api } from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Resources from "./pages/Resources";
import GenericRecords from "./pages/GenericRecords";
import Settings from "./pages/Settings";

type Page = "dashboard" | "resources" | "links" | "publications" | "templates" | "settings";
const navItems: {id: Page; label: string; icon: typeof LayoutDashboard}[] = [
  {id:"dashboard",label:"工作台",icon:LayoutDashboard},
  {id:"resources",label:"资源库",icon:LibraryBig},
  {id:"links",label:"链接维护",icon:Link2},
  {id:"publications",label:"发布内容",icon:NotebookPen},
  {id:"templates",label:"文案模板",icon:Files},
  {id:"settings",label:"连接与设置",icon:SettingsIcon}
];

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function checkSession() {
    try {
      const result = await api<{authenticated:boolean}>("/api/auth/me");
      setAuthenticated(result.authenticated);
    } catch { setAuthenticated(false); }
  }
  useEffect(() => { void checkSession(); }, []);

  async function logout() {
    setLoggingOut(true);
    try { await api("/api/auth/logout", {method:"POST",body:"{}"}); }
    finally { setAuthenticated(false); setLoggingOut(false); }
  }

  if (authenticated === null) return <div className="loading-screen">正在检查登录状态…</div>;
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)}/>;

  function renderPage() {
    switch (page) {
      case "dashboard": return <Dashboard/>;
      case "resources": return <Resources/>;
      case "links": return <Resources linksOnly/>;
      case "publications": return <GenericRecords kind="publications" title="发布内容" description="管理草稿、待发布内容和历史发布记录。需要配置 FEISHU_PUBLICATION_TABLE_ID。"/>;
      case "templates": return <GenericRecords kind="templates" title="文案模板" description="管理可复用的标题和正文模板。需要配置 FEISHU_TEMPLATE_TABLE_ID。"/>;
      case "settings": return <Settings/>;
    }
  }

  return (
    <div className="app-shell">
      {mobileMenu && <div className="mobile-overlay" onClick={() => setMobileMenu(false)}/>}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Boxes size={22}/></div>
          <div><strong>资源工作台</strong><span>FEISHU RESOURCE HUB</span></div>
          <button className="mobile-close icon-button" onClick={() => setMobileMenu(false)}><X size={18}/></button>
        </div>
        <div className="nav-label">管理中心</div>
        <nav>{navItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`}
            onClick={() => {setPage(item.id);setMobileMenu(false);}}>
            <Icon size={18}/><span>{item.label}</span>
          </button>;
        })}</nav>
        <div className="sidebar-bottom"><div className="private-note"><span className="online-dot"/> 私人管理空间</div>
          <button className="nav-item logout-button" onClick={logout} disabled={loggingOut}>
            <LogOut size={17}/><span>{loggingOut ? "退出中…" : "退出登录"}</span>
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)}><Menu size={20}/></button>
          <div className="breadcrumb">资源管理 <span>/</span> {navItems.find((item) => item.id === page)?.label}</div>
          <div className="topbar-right"><span className="topbar-dot"/> 飞书数据源</div>
        </header>
        {renderPage()}
        <footer className="footer">私人资源管理工作台 · 数据由飞书多维表格提供</footer>
      </main>
    </div>
  );
}