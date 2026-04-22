import React, { useState, useRef, useEffect } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS   = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

const isSameDay = (a, b) =>
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const startOf = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };

function buildGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function pad(n) { return String(n).padStart(2, "0"); }

function fmtDisplay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DateRangePicker({ from, to, onChange, tokens }) {
  const today = new Date();
  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [draftFrom, setDraftFrom] = useState(null);   // Date | null
  const [draftTo,   setDraftTo]   = useState(null);   // Date | null
  const [hover,     setHover]     = useState(null);   // Date | null
  const [fromH, setFromH] = useState("00");
  const [fromM, setFromM] = useState("00");
  const [toH,   setToH]   = useState("23");
  const [toM,   setToM]   = useState("59");
  const wrapRef = useRef();

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openPicker = () => {
    const f = from ? new Date(from) : null;
    const t = to   ? new Date(to)   : null;
    setDraftFrom(f);
    setDraftTo(t);
    setFromH(f ? pad(f.getHours())   : "00");
    setFromM(f ? pad(f.getMinutes()) : "00");
    setToH(t ? pad(t.getHours())   : "23");
    setToM(t ? pad(t.getMinutes()) : "59");
    // 시작 날짜가 있으면 해당 월 보여주기
    if (f) { setViewYear(f.getFullYear()); setViewMonth(f.getMonth()); }
    setOpen(true);
  };

  const clickDay = (day) => {
    const d = startOf(day);
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(d);
      setDraftTo(null);
    } else {
      if (d < draftFrom) { setDraftFrom(d); setDraftTo(draftFrom); }
      else               { setDraftTo(d); }
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const apply = () => {
    let f = null, t = null;
    if (draftFrom) {
      f = new Date(draftFrom);
      f.setHours(parseInt(fromH, 10), parseInt(fromM, 10), 0, 0);
    }
    if (draftTo) {
      t = new Date(draftTo);
      t.setHours(parseInt(toH, 10), parseInt(toM, 10), 59, 999);
    }
    onChange(f?.toISOString() ?? null, t?.toISOString() ?? null);
    setOpen(false);
  };

  const clear = () => {
    setDraftFrom(null);
    setDraftTo(null);
    onChange(null, null);
    setOpen(false);
  };

  // 트리거 버튼 표시 텍스트
  const hasRange = from || to;
  const triggerLabel = hasRange
    ? `${fmtDisplay(from) ?? "처음"} ~ ${fmtDisplay(to) ?? "현재"}`
    : "기간 선택";

  const timeInput = (value, onChange) => ({
    style: {
      width: "42px", padding: "4px 6px", textAlign: "center",
      border: `1px solid ${tokens.border}`, borderRadius: "6px",
      background: tokens.bgDeep, color: tokens.textPrimary,
      fontSize: "13px", outline: "none",
    },
    value,
    onChange: (e) => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v)) v = 0;
      onChange(pad(Math.min(Math.max(v, 0), e.target.max ? parseInt(e.target.max) : 99)));
    },
  });

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      {/* 트리거 버튼 */}
      <button onClick={openPicker} style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "6px 14px", borderRadius: "8px",
        border: `1px solid ${hasRange ? "#3b82f6" : tokens.border}`,
        background: hasRange ? "rgba(59,130,246,0.09)" : tokens.bgDeep || tokens.bgCard,
        color: hasRange ? "#3b82f6" : tokens.textSecondary,
        fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
        transition: "all 0.15s",
      }}>
        📅 <span>{triggerLabel}</span>
        <span style={{ fontSize: "9px", opacity: 0.5 }}>▼</span>
      </button>

      {/* 팝오버 */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 2000,
          background: tokens.bgCard, border: `1px solid ${tokens.border}`,
          borderRadius: "14px", padding: "20px 22px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
          minWidth: "290px",
        }}>
          {/* 월 네비게이션 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <button onClick={prevMonth} style={{ background: "none", border: `1px solid ${tokens.border}`, borderRadius: "6px", color: tokens.textSecondary, fontSize: "14px", cursor: "pointer", padding: "3px 10px", lineHeight: 1 }}>‹</button>
            <span style={{ fontSize: "14px", fontWeight: 700, color: tokens.textPrimary }}>{viewYear}년 {MONTHS[viewMonth]}</span>
            <button onClick={nextMonth} style={{ background: "none", border: `1px solid ${tokens.border}`, borderRadius: "6px", color: tokens.textSecondary, fontSize: "14px", cursor: "pointer", padding: "3px 10px", lineHeight: 1 }}>›</button>
          </div>

          {/* 캘린더 */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px" }}>
            <thead>
              <tr>
                {WEEKDAYS.map((d, i) => (
                  <th key={d} style={{ textAlign: "center", padding: "0 0 8px", fontSize: "11px", fontWeight: 600,
                    color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : tokens.textMuted }}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buildGrid(viewYear, viewMonth).map((row, ri) => (
                <tr key={ri}>
                  {row.map((day, ci) => {
                    if (!day) return <td key={ci} style={{ width: "36px", height: "34px" }} />;

                    const isFrom    = isSameDay(day, draftFrom);
                    const isTo      = isSameDay(day, draftTo);
                    const isEnd     = isFrom || isTo;
                    const isToday   = isSameDay(day, today);

                    const previewTo = draftTo || (draftFrom && hover && hover >= draftFrom ? hover : null);
                    const inRange   = draftFrom && previewTo && day > draftFrom && day < previewTo;
                    const isHoverTarget = isSameDay(day, hover) && draftFrom && !draftTo;

                    return (
                      <td key={ci}
                        onClick={() => clickDay(day)}
                        onMouseEnter={() => setHover(day)}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          width: "36px", height: "34px", textAlign: "center",
                          cursor: "pointer",
                          borderRadius: isEnd ? "50%" : inRange ? "0" : "6px",
                          background: isEnd
                            ? "#3b82f6"
                            : inRange
                            ? "rgba(59,130,246,0.14)"
                            : isHoverTarget
                            ? "rgba(59,130,246,0.22)"
                            : "transparent",
                          color: isEnd ? "#fff" : isToday ? "#3b82f6" : tokens.textPrimary,
                          fontSize: "13px",
                          fontWeight: isEnd || isToday ? 700 : 400,
                          userSelect: "none",
                          transition: "background 0.08s",
                          outline: isToday && !isEnd ? `1px solid #3b82f655` : "none",
                        }}>
                        {day.getDate()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* 선택 중 상태 안내 */}
          <div style={{ fontSize: "11px", color: tokens.textMuted, marginBottom: "12px", minHeight: "16px" }}>
            {!draftFrom && !draftTo && "시작 날짜를 클릭하세요"}
            {draftFrom && !draftTo && `${fmtDisplay(startOf(draftFrom).toISOString()).slice(0,10)} 선택됨 — 종료 날짜를 클릭하세요`}
            {draftFrom && draftTo && `${fmtDisplay(startOf(draftFrom).toISOString()).slice(0,10)} ~ ${fmtDisplay(startOf(draftTo).toISOString()).slice(0,10)}`}
          </div>

          {/* 시간 선택 */}
          <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: tokens.textMuted, width: "52px" }}>시작 시간</span>
              <input type="number" min="0" max="23" {...timeInput(fromH, setFromH)} />
              <span style={{ color: tokens.textMuted, fontSize: "13px" }}>:</span>
              <input type="number" min="0" max="59" {...timeInput(fromM, setFromM)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: tokens.textMuted, width: "52px" }}>종료 시간</span>
              <input type="number" min="0" max="23" {...timeInput(toH, setToH)} />
              <span style={{ color: tokens.textMuted, fontSize: "13px" }}>:</span>
              <input type="number" min="0" max="59" {...timeInput(toM, setToM)} />
            </div>
          </div>

          {/* 버튼 */}
          <div style={{ display: "flex", gap: "8px", marginTop: "14px", justifyContent: "flex-end" }}>
            <button onClick={clear} style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${tokens.border}`, background: "transparent", color: tokens.textMuted, fontSize: "12px", cursor: "pointer" }}>
              초기화
            </button>
            <button onClick={apply} style={{ padding: "6px 18px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              조회
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
