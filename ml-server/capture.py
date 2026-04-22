"""
실시간 네트워크 패킷 캡처 → Flow 피처 추출 → Kafka 전송

캡처 방법 우선순위:
  1. scapy + Npcap  (설치되어 있으면 자동 사용, 가장 정밀)
  2. Windows Raw Socket (Npcap 없을 때 폴백, 관리자 권한 필요)
"""
import os
import sys
import time
import json
import struct
import socket
import signal
import logging
import argparse
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("capture")

# ── 설정 ──────────────────────────────────────────────────────────────────────
KAFKA_BROKER   = os.getenv("KAFKA_BROKER",   "localhost:9092")
KAFKA_TOPIC    = os.getenv("KAFKA_TOPIC",    "network-traffic")
FLOW_TIMEOUT   = float(os.getenv("FLOW_TIMEOUT",  "5"))
FLUSH_INTERVAL = float(os.getenv("FLUSH_INTERVAL","5"))

# ── IP 필터 ───────────────────────────────────────────────────────────────────
# Docker 내부 트래픽 및 루프백 제외 (CIDR 형식)
EXCLUDE_SUBNETS_DEFAULT = [
    "172.16.0.0/12",   # Docker 기본 bridge 전체 (172.16~172.31)
    "127.0.0.0/8",     # 루프백
    "169.254.0.0/16",  # 링크-로컬 (APIPA)
]

def _cidr_to_range(cidr: str):
    """CIDR → (network_int, mask_int)"""
    ip_str, prefix = cidr.split("/")
    prefix = int(prefix)
    ip_int = struct.unpack("!I", socket.inet_aton(ip_str))[0]
    mask   = (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF
    return ip_int & mask, mask

def build_exclude_filter(subnets: list):
    """제외 서브넷 목록 → 빠른 판별 함수 반환"""
    ranges = [_cidr_to_range(s) for s in subnets]
    def is_excluded(ip_str: str) -> bool:
        try:
            ip_int = struct.unpack("!I", socket.inet_aton(ip_str))[0]
        except Exception:
            return True
        return any((ip_int & mask) == net for net, mask in ranges)
    return is_excluded
IFACE          = os.getenv("CAPTURE_IFACE",  None)

FlowKey = Tuple[str, str, int, int, int]

# ── 패킷 파싱 헬퍼 ───────────────────────────────────────────────────────────
def parse_ip_header(data: bytes):
    """IP 헤더 파싱 → (src_ip, dst_ip, proto, ip_header_len, total_len)"""
    if len(data) < 20:
        return None
    ihl = (data[0] & 0x0F) * 4
    proto = data[9]
    src = socket.inet_ntoa(data[12:16])
    dst = socket.inet_ntoa(data[16:20])
    total = struct.unpack("!H", data[2:4])[0]
    return src, dst, proto, ihl, total


def parse_tcp_header(data: bytes):
    """TCP 헤더 파싱 → (src_port, dst_port, flags, data_offset)"""
    if len(data) < 20:
        return None
    src_port, dst_port = struct.unpack("!HH", data[0:4])
    flags = data[13]
    data_offset = ((data[12] >> 4) & 0xF) * 4
    return src_port, dst_port, flags, data_offset


def parse_udp_header(data: bytes):
    """UDP 헤더 파싱 → (src_port, dst_port)"""
    if len(data) < 8:
        return None
    src_port, dst_port = struct.unpack("!HH", data[0:4])
    return src_port, dst_port, 0, 8


# ── Flow 데이터 구조 ─────────────────────────────────────────────────────────
@dataclass
class Flow:
    key: FlowKey
    start_ts: float = 0.0
    last_ts:  float = 0.0

    fwd_pkts: List[float] = field(default_factory=list)
    bwd_pkts: List[float] = field(default_factory=list)
    fwd_ts:   List[float] = field(default_factory=list)
    bwd_ts:   List[float] = field(default_factory=list)

    syn: int = 0
    ack: int = 0
    psh: int = 0
    rst: int = 0
    fin: int = 0

    active_start: float = 0.0
    last_active:  float = 0.0
    active_list:  List[float] = field(default_factory=list)
    idle_list:    List[float] = field(default_factory=list)
    ACTIVE_TIMEOUT: float = 1.0

    def add_packet(self, ts: float, length: int, flags: int, is_fwd: bool):
        if self.start_ts == 0.0:
            self.start_ts     = ts
            self.active_start = ts
            self.last_active  = ts

        gap = ts - self.last_active
        if gap > self.ACTIVE_TIMEOUT:
            self.active_list.append(self.last_active - self.active_start)
            self.idle_list.append(gap)
            self.active_start = ts
        self.last_active = ts
        self.last_ts     = ts

        (self.fwd_pkts if is_fwd else self.bwd_pkts).append(length)
        (self.fwd_ts   if is_fwd else self.bwd_ts).append(ts)

        if flags & 0x02: self.syn += 1
        if flags & 0x10: self.ack += 1
        if flags & 0x08: self.psh += 1
        if flags & 0x04: self.rst += 1
        if flags & 0x01: self.fin += 1

    def to_features(self) -> Optional[dict]:
        total_pkts = len(self.fwd_pkts) + len(self.bwd_pkts)
        if total_pkts < 2:
            return None

        duration_us = max((self.last_ts - self.start_ts) * 1_000_000, 1.0)
        duration_s  = duration_us / 1_000_000
        total_bytes = sum(self.fwd_pkts) + sum(self.bwd_pkts)

        def iat_mean(ts_list):
            if len(ts_list) < 2:
                return 0.0
            return float(np.mean([(ts_list[i+1]-ts_list[i])*1e6 for i in range(len(ts_list)-1)]))

        active_list = self.active_list + [self.last_active - self.active_start]
        idle_list   = self.idle_list if self.idle_list else [0.0]

        return {
            "flow_duration":        duration_us,
            "total_fwd_packets":    float(len(self.fwd_pkts)),
            "total_bwd_packets":    float(len(self.bwd_pkts)),
            "flow_bytes_per_sec":   total_bytes / duration_s,
            "flow_packets_per_sec": total_pkts  / duration_s,
            "fwd_packet_len_mean":  float(np.mean(self.fwd_pkts)) if self.fwd_pkts else 0.0,
            "bwd_packet_len_mean":  float(np.mean(self.bwd_pkts)) if self.bwd_pkts else 0.0,
            "syn_flag_count":       float(self.syn),
            "ack_flag_count":       float(self.ack),
            "psh_flag_count":       float(self.psh),
            "rst_flag_count":       float(self.rst),
            "fin_flag_count":       float(self.fin),
            "fwd_iat_mean":         iat_mean(self.fwd_ts),
            "bwd_iat_mean":         iat_mean(self.bwd_ts),
            "active_mean":          float(np.mean(active_list)) * 1e6,
            "idle_mean":            float(np.mean(idle_list))   * 1e6,
            "down_up_ratio":        len(self.bwd_pkts) / max(len(self.fwd_pkts), 1),
            "avg_packet_size":      total_bytes / max(total_pkts, 1),
        }


# ── Flow 테이블 ───────────────────────────────────────────────────────────────
class FlowTable:
    def __init__(self, exclude_filter=None):
        self._flows: Dict[FlowKey, Flow] = {}
        self._lock = threading.Lock()
        self._is_excluded = exclude_filter or (lambda ip: False)
        self._skipped = 0

    def _normalize_key(self, src_ip, dst_ip, src_port, dst_port, proto) -> Tuple[FlowKey, bool]:
        if (src_ip, src_port) <= (dst_ip, dst_port):
            return (src_ip, dst_ip, src_port, dst_port, proto), True
        return (dst_ip, src_ip, dst_port, src_port, proto), False

    def add(self, src_ip, dst_ip, src_port, dst_port, proto, ts, length, flags):
        # Docker/루프백 트래픽 제외
        if self._is_excluded(src_ip) or self._is_excluded(dst_ip):
            self._skipped += 1
            return
        key, is_fwd = self._normalize_key(src_ip, dst_ip, src_port, dst_port, proto)
        with self._lock:
            if key not in self._flows:
                self._flows[key] = Flow(key=key)
            self._flows[key].add_packet(ts, length, flags, is_fwd)

    def pop_expired(self, now: float, timeout: float) -> List[Flow]:
        with self._lock:
            dead = [k for k, f in self._flows.items() if now - f.last_ts > timeout]
            return [self._flows.pop(k) for k in dead]

    def pop_all(self) -> List[Flow]:
        with self._lock:
            flows = list(self._flows.values())
            self._flows.clear()
            return flows


# ── Kafka 프로듀서 ────────────────────────────────────────────────────────────
def make_producer(broker: str):
    from kafka import KafkaProducer
    return KafkaProducer(
        bootstrap_servers=[broker],
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
    )


# ── 플러시 스레드 ─────────────────────────────────────────────────────────────
def flush_thread(table: FlowTable, producer, stop_event: threading.Event):
    sent_total = 0
    while not stop_event.is_set():
        stop_event.wait(FLUSH_INTERVAL)
        expired = table.pop_expired(time.time(), FLOW_TIMEOUT)
        batch = 0
        for flow in expired:
            feat = flow.to_features()
            if feat:
                producer.send(KAFKA_TOPIC, value=feat)
                batch += 1
        if batch:
            producer.flush()
            sent_total += batch
            log.info(f"Kafka 전송: {batch}개 플로우 (누적 {sent_total}개)")

    for flow in table.pop_all():
        feat = flow.to_features()
        if feat:
            producer.send(KAFKA_TOPIC, value=feat)
    producer.flush()
    log.info("캡처 종료 — 남은 플로우 전송 완료")


# ── 캡처 방법 1: scapy (Npcap 필요) ─────────────────────────────────────────
def sniff_scapy(table: FlowTable, iface: Optional[str], stop_event: threading.Event, bpf: str):
    from scapy.all import sniff, conf, IP, TCP, UDP
    conf.verb = 0

    def handle(pkt):
        if not pkt.haslayer(IP):
            return
        ip     = pkt[IP]
        ts     = float(pkt.time)
        length = len(pkt)
        proto  = ip.proto
        flags  = 0
        sport = dport = 0
        if pkt.haslayer(TCP):
            flags = int(pkt[TCP].flags)
            sport = pkt[TCP].sport
            dport = pkt[TCP].dport
        elif pkt.haslayer(UDP):
            sport = pkt.sport
            dport = pkt.dport
        table.add(ip.src, ip.dst, sport, dport, proto, ts, length, flags)

    log.info("캡처 방법: scapy (Npcap)")
    sniff(
        iface=iface,
        filter=bpf,
        prn=handle,
        store=False,
        stop_filter=lambda _: stop_event.is_set(),
    )


# ── 캡처 방법 2: Windows Raw Socket (Npcap 불필요) ──────────────────────────
def sniff_raw_socket(table: FlowTable, stop_event: threading.Event):
    """
    Windows Raw Socket으로 IP 패킷 캡처
    - 관리자 권한 필요
    - ICMP/TCP/UDP 패킷 수신 (Ethernet 헤더 없음)
    """
    # 현재 머신의 기본 IP 주소 획득
    s_temp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s_temp.connect(("8.8.8.8", 80))
    local_ip = s_temp.getsockname()[0]
    s_temp.close()

    log.info(f"캡처 방법: Windows Raw Socket  (로컬 IP: {local_ip})")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_IP)
        sock.bind((local_ip, 0))
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
        sock.ioctl(socket.SIO_RCVALL, socket.RCVALL_ON)
    except PermissionError:
        log.error("권한 오류: 반드시 관리자 권한으로 실행하세요.")
        return
    except OSError as e:
        log.error(f"소켓 오류: {e}")
        return

    sock.settimeout(1.0)
    try:
        while not stop_event.is_set():
            try:
                raw, _ = sock.recvfrom(65535)
            except socket.timeout:
                continue

            ts     = time.time()
            parsed = parse_ip_header(raw)
            if not parsed:
                continue
            src_ip, dst_ip, proto, ihl, total = parsed

            payload = raw[ihl:]
            flags = sport = dport = 0

            if proto == 6 and len(payload) >= 20:    # TCP
                tcp = parse_tcp_header(payload)
                if tcp:
                    sport, dport, flags, _ = tcp
            elif proto == 17 and len(payload) >= 8:  # UDP
                udp = parse_udp_header(payload)
                if udp:
                    sport, dport, _, _ = udp

            table.add(src_ip, dst_ip, sport, dport, proto, ts, total, flags)
    finally:
        try:
            sock.ioctl(socket.SIO_RCVALL, socket.RCVALL_OFF)
        except Exception:
            pass
        sock.close()


# ── 인터페이스 안내 ───────────────────────────────────────────────────────────
def list_interfaces():
    try:
        from scapy.all import get_if_list
        ifaces = get_if_list()
        log.info(f"사용 가능한 인터페이스 ({len(ifaces)}개):")
        for i, iface in enumerate(ifaces):
            log.info(f"  [{i}] {iface}")
    except Exception:
        log.info("인터페이스 목록을 가져올 수 없습니다.")


# ── 메인 ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="실시간 네트워크 캡처 → Kafka")
    parser.add_argument("--iface",      default=IFACE,           help="캡처 인터페이스")
    parser.add_argument("--broker",     default=KAFKA_BROKER,    help="Kafka 브로커")
    parser.add_argument("--topic",      default=KAFKA_TOPIC,     help="Kafka 토픽")
    parser.add_argument("--timeout",    default=FLOW_TIMEOUT,    type=float)
    parser.add_argument("--flush",      default=FLUSH_INTERVAL,  type=float)
    parser.add_argument("--filter",     default="ip",            help="BPF 필터 (scapy 모드 전용)")
    parser.add_argument("--list-iface", action="store_true",     help="인터페이스 목록 출력")
    parser.add_argument("--raw",        action="store_true",     help="강제로 Raw Socket 사용")
    parser.add_argument("--exclude",    nargs="*",               help="추가로 제외할 CIDR (기본값에 추가)")
    parser.add_argument("--no-exclude", action="store_true",     help="IP 필터 비활성화")
    args = parser.parse_args()

    if args.list_iface:
        list_interfaces()
        return

    log.info(f"Kafka: {args.broker}  토픽: {args.topic}")

    try:
        producer = make_producer(args.broker)
        log.info("Kafka 프로듀서 연결 완료")
    except Exception as e:
        log.error(f"Kafka 연결 실패: {e}")
        sys.exit(1)

    # IP 필터 구성
    if args.no_exclude:
        exclude_fn = None
        log.info("IP 필터 비활성화됨")
    else:
        subnets = list(EXCLUDE_SUBNETS_DEFAULT)
        if args.exclude:
            subnets.extend(args.exclude)
        log.info(f"제외 서브넷: {subnets}")
        exclude_fn = build_exclude_filter(subnets)

    table      = FlowTable(exclude_filter=exclude_fn)
    stop_event = threading.Event()

    flusher = threading.Thread(
        target=flush_thread, args=(table, producer, stop_event), daemon=True
    )
    flusher.start()

    def on_stop(sig, frame):
        log.info("종료 신호 수신...")
        stop_event.set()

    signal.signal(signal.SIGINT,  on_stop)
    signal.signal(signal.SIGTERM, on_stop)

    log.info("패킷 캡처 시작 (Ctrl+C로 종료)")

    use_scapy = False
    if not args.raw:
        try:
            from scapy.all import sniff as _sniff
            # Npcap 실제 사용 가능 여부 테스트
            from scapy.arch.windows import get_windows_if_list
            test_pkts = []
            t = threading.Thread(
                target=lambda: _sniff(timeout=1, count=1, prn=lambda p: test_pkts.append(p), store=False),
                daemon=True
            )
            t.start(); t.join(timeout=3)
            use_scapy = True
        except Exception:
            use_scapy = False

    if use_scapy:
        sniff_scapy(table, args.iface, stop_event, args.filter)
    else:
        log.warning("Npcap 미감지 → Windows Raw Socket 모드로 전환")
        sniff_raw_socket(table, stop_event)

    flusher.join(timeout=10)


if __name__ == "__main__":
    main()
