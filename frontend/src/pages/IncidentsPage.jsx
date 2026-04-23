import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";

const SEVERITY_META = {
  critical: { label: "심각", color: "#dc2626" },
  high:     { label: "높음", color: "#ef4444" },
  medium:   { label: "보통", color: "#f97316" },
  low:      { label: "낮음", color: "#eab308" },
};
const STATUS_META = {
  open:        { label: "미처리",  color: "#ef4444" },
  in_progress: { label: "처리 중", color: "#3b82f6" },
  resolved:    { label: "해결됨",  color: "#22c55e" },
  dismissed:   { label: "무시됨",  color: "#64748b" },
};
const LABEL_COLORS = {
  BENIGN: "#22c55e", DoS: "#ef4444", DDoS: "#dc2626",
  PortScan: "#f97316", BruteForce: "#eab308", WebAttack: "#a855f7", Botnet: "#ec4899",
};
const ATTACK_LABELS = ["DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Botnet"];
const STATUS_LIST   = ["open", "in_progress", "resolved", "dismissed"];

function NewIncidentModal({ onClose, onCreate }) {
  const { tokens } = useTheme();
  const [form, setForm] = useState({ label: "DDoS", severity: "medium", title: "", notes: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(form);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
        style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "14px", padding: "28px", width: "min(480px, 90vw)", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", color: tokens.textPrimary }}>새 인시던트 생성</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: tokens.textMuted, fontSize: "20px", cursor: "pointer" }}>×</button>
        </div>

        <Field label="공격 유형" tokens={tokens}>
          <select value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            style={selectStyle(tokens)}>
            {ATTACK_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>

        <Field label="심각도" tokens={tokens}>
          <select value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
            style={selectStyle(tokens)}>
            {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>

        <Field label="제목" tokens={tokens}>
          <input type="text" value={form.title} placeholder="인시던트 제목 (선택)"
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            style={inputStyle(tokens)} />
        </Field>

        <Field label="메모" tokens={tokens}>
          <textarea value={form.notes} rows={3} placeholder="상황 설명, 대응 내용 등"
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            style={{ ...inputStyle(tokens), resize: "vertical", fontFamily: "inherit" }} />
        </Field>

        <button type="submit" style={{ padding: "10px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
          생성
        </button>
      </form>
    </div>
  );
}

function NotesModal({ incident, onClose, onSave }) {
  const { tokens } = useTheme();
  const [notes, setNotes] = useState(incident.notes || "");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "14px", padding: "24px", width: "min(480px, 90vw)", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "15px", color: tokens.textPrimary }}>
            <span style={{ color: LABEL_COLORS[incident.label] || "#94a3b8" }}>[{incident.label}]</span> 메모
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: tokens.textMuted, fontSize: "20px", cursor: "pointer" }}>×</button>
        </div>
        <textarea value={notes} rows={6} onChange={(e) => setNotes(e.target.value)}
          style={{ ...inputStyle(tokens), resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: "7px", border: `1px solid ${tokens.border}`, background: "none", color: tokens.textMuted, cursor: "pointer" }}>취소</button>
          <button onClick={() => onSave(notes)} style={{ padding: "7px 20px", borderRadius: "7px", border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 600 }}>저장</button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  const { tokens } = useTheme();
  const [incidents,   setIncidents]   = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreate,  setShowCreate]  = useState(false);
  const [notesTarget, setNotesTarget] = useState(null);
  const [loading,     setLoading]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const q = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
    fetch(`/api/incidents${q}`)
      .then((r) => r.json())
      .then((data) => { setIncidents(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (form) => {
    await fetch("/api/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowCreate(false);
    load();
  }, [load]);

  const updateStatus = useCallback(async (id, status) => {
    await fetch(`/api/incidents/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }, [load]);

  const saveNotes = useCallback(async (notes) => {
    await fetch(`/api/incidents/${notesTarget.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
    setNotesTarget(null);
    load();
  }, [notesTarget, load]);

  const remove = useCallback(async (id) => {
    if (!window.confirm("인시던트를 삭제하시겠습니까?")) return;
    await fetch(`/api/incidents/${id}`, { method: "DELETE" });
    load();
  }, [load]);

  const openCount = incidents.filter((i) => i.status === "open").length;

  return (
    <>
      {showCreate  && <NewIncidentModal onClose={() => setShowCreate(false)} onCreate={create} />}
      {notesTarget && <NotesModal incident={notesTarget} onClose={() => setNotesTarget(null)} onSave={saveNotes} />}

      <div style={{ padding: "28px", maxWidth: "1100px" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: tokens.textPrimary }}>
              인시던트 관리
              {openCount > 0 && (
                <span style={{ marginLeft: "10px", background: "#ef4444", color: "#fff", borderRadius: "999px", fontSize: "12px", padding: "2px 8px" }}>
                  {openCount}
                </span>
              )}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: tokens.textMuted }}>탐지 이벤트를 인시던트로 격상하여 처리 상태를 추적합니다</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            + 새 인시던트
          </button>
        </div>

        {/* 상태 필터 */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {["ALL", ...STATUS_LIST].map((s) => {
            const meta   = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{
                  padding: "5px 14px", borderRadius: "999px", border: "1px solid",
                  fontSize: "12px", cursor: "pointer",
                  borderColor: active ? (meta?.color || "#3b82f6") : tokens.border,
                  background:  active ? `${meta?.color || "#3b82f6"}18` : "transparent",
                  color:       active ? (meta?.color || "#3b82f6") : tokens.textMuted,
                  transition: "all 0.15s",
                }}>
                {meta ? meta.label : "전체"}
              </button>
            );
          })}
        </div>

        {/* 인시던트 목록 */}
        {loading ? (
          <div style={{ textAlign: "center", color: tokens.textMuted, padding: "60px" }}>불러오는 중…</div>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: "center", color: tokens.textDim, padding: "60px", fontSize: "14px" }}>인시던트 없음</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {incidents.map((inc) => {
              const sev    = SEVERITY_META[inc.severity] || SEVERITY_META.medium;
              const sta    = STATUS_META[inc.status]     || STATUS_META.open;
              const lcolor = LABEL_COLORS[inc.label]     || "#94a3b8";
              return (
                <div key={inc.id} style={{
                  background: tokens.bgCard, border: `1px solid ${tokens.border}`,
                  borderLeft: `4px solid ${lcolor}`, borderRadius: "10px", padding: "16px 20px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: `${lcolor}22`, color: lcolor }}>{inc.label}</span>
                      <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: `${sev.color}18`, color: sev.color }}>{sev.label}</span>
                      <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: `${sta.color}15`, color: sta.color }}>{sta.label}</span>
                      <span style={{ fontSize: "13px", color: tokens.textPrimary, fontWeight: 600 }}>
                        {inc.title || `#${inc.id} — ${inc.label} 인시던트`}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: tokens.textDim, whiteSpace: "nowrap" }}>
                      {new Date(inc.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>

                  {inc.notes && (
                    <p style={{ margin: "10px 0 0", fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.6, borderTop: `1px solid ${tokens.borderLight}`, paddingTop: "10px" }}>
                      {inc.notes}
                    </p>
                  )}

                  {/* 액션 */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
                    {STATUS_LIST.filter((s) => s !== inc.status).map((s) => (
                      <button key={s} onClick={() => updateStatus(inc.id, s)}
                        style={{
                          padding: "3px 12px", borderRadius: "6px", border: `1px solid ${STATUS_META[s].color}44`,
                          background: `${STATUS_META[s].color}10`, color: STATUS_META[s].color,
                          fontSize: "11px", cursor: "pointer", fontWeight: 600,
                        }}>
                        → {STATUS_META[s].label}
                      </button>
                    ))}
                    <button onClick={() => setNotesTarget(inc)}
                      style={{ padding: "3px 12px", borderRadius: "6px", border: `1px solid ${tokens.border}`, background: "none", color: tokens.textMuted, fontSize: "11px", cursor: "pointer" }}>
                      메모 편집
                    </button>
                    <button onClick={() => remove(inc.id)}
                      style={{ padding: "3px 12px", borderRadius: "6px", border: `1px solid #ef444444`, background: "#ef444410", color: "#ef4444", fontSize: "11px", cursor: "pointer" }}>
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, tokens, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", color: tokens.textMuted, marginBottom: "4px" }}>{label}</label>
      {children}
    </div>
  );
}

function selectStyle(tokens) {
  return { width: "100%", padding: "8px 10px", borderRadius: "7px", border: `1px solid ${tokens.border}`, background: tokens.bgInput, color: tokens.textPrimary, fontSize: "13px" };
}
function inputStyle(tokens) {
  return { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "7px", border: `1px solid ${tokens.border}`, background: tokens.bgInput, color: tokens.textPrimary, fontSize: "13px", outline: "none" };
}
