import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";

const ATTACKS = [
  {
    id: "DDoS",
    color: "#dc2626",
    icon: "💥",
    name: "DDoS (분산 서비스 거부)",
    summary: "다수의 좀비 PC가 동시에 대량 트래픽을 발생시켜 서버를 마비시키는 공격",
    detail: "수천~수백만 대의 감염된 장치(봇넷)가 협력하여 특정 서버나 네트워크에 대규모 트래픽을 쏟아붓는 공격입니다. 단일 출처가 아닌 분산된 다수의 출처에서 동시에 발생하기 때문에 차단이 매우 어렵습니다.",
    indicators: ["급격한 인바운드 패킷 증가", "다수 IP에서 동시 접속", "대역폭 포화 상태", "SYN 플러드, UDP 플러드, HTTP 플러드"],
    features: { flow_bytes_per_sec: "매우 높음", syn_flag_count: "높음", total_fwd_packets: "매우 높음", flow_duration: "짧음" },
    mitigation: ["트래픽 스크러빙 서비스 (CloudFlare 등)", "Rate Limiting", "ISP 레벨 업스트림 필터링", "Anycast 분산 네트워크"],
  },
  {
    id: "DoS",
    color: "#ef4444",
    icon: "🔴",
    name: "DoS (서비스 거부)",
    summary: "단일 출처에서 서버 자원을 고갈시켜 정상 서비스를 불가능하게 만드는 공격",
    detail: "단일 공격자가 서버의 CPU, 메모리, 네트워크 대역폭 등의 자원을 과도하게 소모시켜 정상 사용자의 접근을 막는 공격입니다. Slowloris처럼 소량의 패킷으로 연결을 독점하는 저속형도 있습니다.",
    indicators: ["서버 응답 지연 또는 무응답", "연결 수 급증", "CPU/메모리 사용률 급등", "비정상적으로 긴 연결 유지"],
    features: { flow_duration: "매우 길거나 매우 짧음", flow_packets_per_sec: "높음 또는 매우 낮음", syn_flag_count: "높음", idle_mean: "높음 (Slowloris)" },
    mitigation: ["연결 제한 및 타임아웃 설정", "Web Application Firewall", "IP 차단 리스트", "SYN 쿠키 활성화"],
  },
  {
    id: "PortScan",
    color: "#f97316",
    icon: "🔍",
    name: "PortScan (포트 스캔)",
    summary: "공격자가 대상 시스템의 열린 포트와 서비스를 탐색하는 사전 정찰 활동",
    detail: "본격적인 공격 전 단계로, 공격자는 다양한 포트에 연결 시도를 하여 어떤 서비스가 실행 중인지 파악합니다. SYN 스캔, Full Connect 스캔, UDP 스캔 등 여러 방식이 있습니다. 그 자체로는 직접적 피해가 없지만 후속 공격의 전조입니다.",
    indicators: ["다수 포트에 대한 순차적 접속 시도", "짧은 연결 후 즉시 종료 (RST)", "비정상적 SYN만 전송", "동일 IP에서 대량 포트 시도"],
    features: { total_fwd_packets: "낮음 (1~2개)", rst_flag_count: "높음", fin_flag_count: "낮음", down_up_ratio: "낮음" },
    mitigation: ["포트 스캔 탐지 IDS/IPS", "불필요한 포트 차단", "포트 노킹", "방화벽 로그 모니터링"],
  },
  {
    id: "BruteForce",
    color: "#eab308",
    icon: "🔑",
    name: "BruteForce (무차별 대입)",
    summary: "수많은 패스워드 조합을 자동으로 시도하여 계정에 침입하는 공격",
    detail: "FTP, SSH, HTTP 등 인증이 필요한 서비스에 대해 사전 파일이나 무작위 문자열을 이용하여 로그인을 반복 시도하는 공격입니다. 성공 시 서버 전체 제어권을 탈취할 수 있어 위험도가 높습니다.",
    indicators: ["동일 서비스에 반복 로그인 실패", "짧은 간격의 연속 연결", "다양한 사용자명/패스워드 시도", "특정 포트(22, 21, 3389)에 트래픽 집중"],
    features: { flow_packets_per_sec: "일정하게 높음", fwd_iat_mean: "매우 짧음", total_fwd_packets: "균일함", ack_flag_count: "높음" },
    mitigation: ["계정 잠금 정책", "다단계 인증(MFA)", "fail2ban 설치", "기본 포트 변경 (SSH 22 → 비표준)"],
  },
  {
    id: "WebAttack",
    color: "#a855f7",
    icon: "🌐",
    name: "WebAttack (웹 공격)",
    summary: "SQL Injection, XSS 등 웹 애플리케이션 취약점을 이용한 공격",
    detail: "웹 애플리케이션의 입력 검증 부재를 이용하여 데이터베이스 탈취(SQL Injection), 악성 스크립트 삽입(XSS), 또는 무차별 폼 대입(Brute Force)을 시도합니다. 네트워크 레벨보다 애플리케이션 레벨에서 탐지가 필요합니다.",
    indicators: ["비정상적 HTTP 파라미터", "긴 URL 또는 특수문자 포함 요청", "짧은 세션 내 다수 요청", "4xx/5xx 에러 급증"],
    features: { avg_packet_size: "특징적으로 큼 (페이로드 포함)", flow_bytes_per_sec: "중간", psh_flag_count: "높음", flow_duration: "짧음" },
    mitigation: ["Web Application Firewall (WAF)", "입력값 검증 및 이스케이프", "준비된 쿼리(Prepared Statement)", "Content Security Policy 헤더"],
  },
  {
    id: "Botnet",
    color: "#ec4899",
    icon: "🤖",
    name: "Botnet (봇넷)",
    summary: "악성코드에 감염된 장치가 공격자의 명령을 받아 실행하는 네트워크",
    detail: "감염된 기기(봇)가 C&C(명령제어) 서버와 주기적으로 통신하며 대기합니다. DDoS 공격, 스팸 발송, 암호화폐 채굴 등 다양한 악의적 행위에 동원됩니다. 비콘 주기가 일정하다는 특성이 있습니다.",
    indicators: ["주기적인 외부 서버 통신 (비코닝)", "비정상 시간대 트래픽", "암호화된 C&C 통신", "내부 → 외부 방향 트래픽 증가"],
    features: { fwd_iat_mean: "주기적으로 일정", idle_mean: "높음 (대기 상태)", down_up_ratio: "낮음", flow_duration: "매우 길거나 주기적"},
    mitigation: ["DNS 싱크홀", "알려진 C&C IP/도메인 차단", "엔드포인트 보안 솔루션", "이상 트래픽 패턴 모니터링"],
  },
];

const FEATURE_LABELS = {
  flow_bytes_per_sec:   "초당 트래픽량",
  flow_packets_per_sec: "초당 패킷 수",
  flow_duration:        "플로우 지속 시간",
  syn_flag_count:       "SYN 플래그",
  rst_flag_count:       "RST 플래그",
  fin_flag_count:       "FIN 플래그",
  ack_flag_count:       "ACK 플래그",
  psh_flag_count:       "PSH 플래그",
  total_fwd_packets:    "전방향 패킷 수",
  fwd_iat_mean:         "패킷 간격 평균",
  idle_mean:            "유휴 시간 평균",
  avg_packet_size:      "평균 패킷 크기",
  down_up_ratio:        "수신/송신 비율",
};

export default function AttackPatternsPage() {
  const { tokens } = useTheme();
  const [selected, setSelected] = useState("DDoS");
  const attack = ATTACKS.find((a) => a.id === selected);

  return (
    <div style={{ padding: "28px", maxWidth: "1100px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: tokens.textPrimary }}>공격 패턴 설명</h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: tokens.textMuted }}>탐지 대상 공격 유형별 특성 및 대응 방법</p>
      </div>

      {/* 공격 유형 선택 탭 */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
        {ATTACKS.map((a) => (
          <button key={a.id} onClick={() => setSelected(a.id)}
            style={{
              padding: "8px 16px", borderRadius: "999px", border: "1px solid",
              fontSize: "13px", cursor: "pointer", fontWeight: selected === a.id ? 700 : 400,
              borderColor: selected === a.id ? a.color : tokens.border,
              background:  selected === a.id ? `${a.color}18` : tokens.bgCard,
              color:       selected === a.id ? a.color : tokens.textSecondary,
              transition:  "all 0.15s",
            }}>
            {a.icon} {a.id}
          </button>
        ))}
      </div>

      {attack && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px" }}>
          {/* 좌측: 상세 설명 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* 개요 카드 */}
            <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderTop: `3px solid ${attack.color}`, borderRadius: "12px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <span style={{ fontSize: "32px" }}>{attack.icon}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: attack.color }}>{attack.name}</h2>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: tokens.textSecondary }}>{attack.summary}</p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: tokens.textSecondary, lineHeight: 1.7 }}>{attack.detail}</p>
            </div>

            {/* 탐지 지표 */}
            <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>🔎 주요 탐지 지표</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {attack.indicators.map((ind, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <span style={{ color: attack.color, fontWeight: 700, marginTop: "1px" }}>▸</span>
                    <span style={{ fontSize: "14px", color: tokens.textSecondary, lineHeight: 1.5 }}>{ind}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 대응 방법 */}
            <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>🛡️ 대응 및 완화 방법</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {attack.mitigation.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", background: `${attack.color}0d`, borderRadius: "8px", border: `1px solid ${attack.color}22` }}>
                    <span style={{ color: attack.color, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: "14px", color: tokens.textSecondary }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 우측: ML 피처 특성 */}
          <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: "12px", padding: "24px", alignSelf: "start" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: tokens.textPrimary, fontWeight: 600 }}>📐 XGBoost 모델 피처 특성</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: tokens.textMuted }}>CICIDS2017 학습 기준, 해당 공격 유형에서 두드러지는 피처 패턴</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Object.entries(attack.features).map(([key, val]) => (
                <div key={key} style={{ padding: "10px 12px", background: tokens.bgDeep, borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: tokens.textMuted, marginBottom: "2px" }}>{FEATURE_LABELS[key] || key}</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: attack.color }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
