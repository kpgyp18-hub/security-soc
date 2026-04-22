import React from "react";
import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

const NAV_ITEMS = [
  { to: "/",        icon: "📡", label: "모니터링" },
  { to: "/attacks", icon: "🛡️", label: "공격 패턴" },
  { to: "/report",  icon: "📊", label: "리포트" },
];

export default function Sidebar() {
  const { tokens, mode, toggleTheme } = useTheme();

  return (
    <aside style={{
      width: "200px", flexShrink: 0,
      background: tokens.bgCard,
      borderRight: `1px solid ${tokens.border}`,
      display: "flex", flexDirection: "column",
      minHeight: "100vh",
      position: "sticky", top: 0,
      transition: "background 0.2s",
    }}>
      {/* 로고 + 테마 토글 */}
      <div style={{ padding: "20px 14px 16px", borderBottom: `1px solid ${tokens.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🔐</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "14px", color: tokens.textPrimary, lineHeight: 1.2 }}>Security</div>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "#3b82f6", lineHeight: 1.2 }}>SOC</div>
          </div>
        </div>
        <button onClick={toggleTheme} title={mode === "dark" ? "라이트 모드" : "다크 모드"}
          style={{
            width: "30px", height: "30px", borderRadius: "8px",
            border: `1px solid ${tokens.border}`,
            background: "transparent",
            color: tokens.textSecondary,
            fontSize: "15px", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}>
          {mode === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {/* 메뉴 */}
      <nav style={{ flex: 1, padding: "16px 10px" }}>
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === "/"}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 12px", borderRadius: "8px",
              marginBottom: "4px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "#3b82f6" : tokens.textSecondary,
              background: isActive ? `${tokens.btnBgActive}` : "transparent",
              transition: "all 0.15s",
            })}
          >
            <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

    </aside>
  );
}
