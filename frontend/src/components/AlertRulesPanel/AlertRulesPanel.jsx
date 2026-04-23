import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";

const LABEL_COLORS = {
  DDoS: "#dc2626", DoS: "#ef4444", PortScan: "#f97316",
  BruteForce: "#eab308", WebAttack: "#a855f7", Botnet: "#ec4899",
};

export default function AlertRulesPanel() {
  const { tokens } = useTheme();
  const [rules,   setRules]   = useState([]);
  const [editing, setEditing] = useState(null); // label 중 하나
  const [draft,   setDraft]   = useState({});
  const [saving,  setSaving]  = useState(false);
  const [open,    setOpen]    = useState(false);

  const fetchRules = useCallback(() => {
    fetch("/api/alert-rules")
      .then((r) => r.json())
      .then(setRules)
      .catch(() => {});
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const startEdit = (rule) => {
    setEditing(rule.label);
    setDraft({ threshold: rule.threshold, windowSec: rule.windowSec });
  };

  const cancelEdit = () => { setEditing(null); setDraft({}); };

  const saveRule = async (label) => {
    setSaving(true);
    try {
      await fetch(`/api/alert-rules/${label}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      await fetchRules();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: tokens.bgCard, borderRadius: "12px", border: `1px solid ${tokens.border}` }}>
      {/* 헤더 */}
      <div
        onClick={() => setOpen((p) => !p)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", cursor: "pointer", userSelect: "none" }}
      >
        <h3 style={{ margin: 0, fontSize: "13px", color: tokens.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          알림 임계값 설정
        </h3>
        <span style={{ color: tokens.textDim, fontSize: "12px" }}>{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${tokens.border}`, padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {rules.map((rule) => {
            const color     = LABEL_COLORS[rule.label] || "#94a3b8";
            const isEditing = editing === rule.label;
            return (
              <div
                key={rule.label}
                style={{
                  padding: "12px 14px",
                  background: tokens.bgDeep,
                  borderRadius: "8px",
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isEditing ? "12px" : 0 }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color }}>{rule.label}</span>
                  {!isEditing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "12px", color: tokens.textMuted }}>
                        {rule.windowSec}초 내 <strong style={{ color: tokens.textPrimary }}>{rule.threshold}건</strong>
                      </span>
                      <button
                        onClick={() => startEdit(rule)}
                        style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "6px", border: `1px solid ${tokens.border}`, background: "none", color: tokens.textMuted, cursor: "pointer" }}
                      >
                        수정
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => saveRule(rule.label)}
                        disabled={saving}
                        style={{ fontSize: "11px", padding: "2px 12px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer" }}
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "6px", border: `1px solid ${tokens.border}`, background: "none", color: tokens.textMuted, cursor: "pointer" }}
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ fontSize: "12px", color: tokens.textMuted }}>
                      임계값 (건): <strong style={{ color: tokens.textPrimary }}>{draft.threshold}</strong>
                      <input
                        type="range" min="1" max="50" value={draft.threshold}
                        onChange={(e) => setDraft((p) => ({ ...p, threshold: Number(e.target.value) }))}
                        style={{ display: "block", width: "100%", marginTop: "4px", accentColor: color }}
                      />
                    </label>
                    <label style={{ fontSize: "12px", color: tokens.textMuted }}>
                      감지 윈도우: <strong style={{ color: tokens.textPrimary }}>{draft.windowSec}초</strong>
                      <input
                        type="range" min="10" max="300" step="10" value={draft.windowSec}
                        onChange={(e) => setDraft((p) => ({ ...p, windowSec: Number(e.target.value) }))}
                        style={{ display: "block", width: "100%", marginTop: "4px", accentColor: color }}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: tokens.textDim }}>
            변경사항은 서버 재시작 전까지 유지됩니다
          </p>
        </div>
      )}
    </div>
  );
}
