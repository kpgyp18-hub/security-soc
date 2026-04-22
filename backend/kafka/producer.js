const { Kafka } = require("kafkajs");
require("dotenv").config({ path: "../.env" });

const kafka = new Kafka({
  clientId: "soc-producer",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});

const producer = kafka.producer();
const TOPIC = process.env.KAFKA_TOPIC || "network-traffic";

const ATTACK_PROFILES = {
  BENIGN: () => ({
    flow_duration: rand(1000, 50000),
    total_fwd_packets: randInt(5, 100),
    total_bwd_packets: randInt(5, 100),
    flow_bytes_per_sec: rand(100, 5000),
    flow_packets_per_sec: rand(1, 50),
    fwd_packet_len_mean: rand(50, 500),
    bwd_packet_len_mean: rand(50, 500),
    syn_flag_count: randInt(0, 2),
    ack_flag_count: randInt(1, 10),
    psh_flag_count: randInt(0, 5),
    rst_flag_count: randInt(0, 1),
    fin_flag_count: randInt(0, 2),
    fwd_iat_mean: rand(100, 5000),
    bwd_iat_mean: rand(100, 5000),
    active_mean: rand(500, 10000),
    idle_mean: rand(500, 50000),
    down_up_ratio: rand(0.5, 2.0),
    avg_packet_size: rand(50, 500),
  }),
  DoS: () => ({
    flow_duration: rand(50000, 200000),
    total_fwd_packets: randInt(500, 5000),
    total_bwd_packets: randInt(0, 10),
    flow_bytes_per_sec: rand(50000, 500000),
    flow_packets_per_sec: rand(500, 5000),
    fwd_packet_len_mean: rand(10, 60),
    bwd_packet_len_mean: rand(0, 20),
    syn_flag_count: randInt(0, 2),
    ack_flag_count: randInt(0, 3),
    psh_flag_count: randInt(10, 100),
    rst_flag_count: randInt(0, 2),
    fin_flag_count: randInt(0, 2),
    fwd_iat_mean: rand(10, 500),
    bwd_iat_mean: rand(0, 100),
    active_mean: rand(100, 2000),
    idle_mean: rand(0, 1000),
    down_up_ratio: rand(0.0, 0.1),
    avg_packet_size: rand(10, 60),
  }),
  DDoS: () => ({
    flow_duration: rand(1000, 10000),
    total_fwd_packets: randInt(100, 1000),
    total_bwd_packets: randInt(0, 5),
    flow_bytes_per_sec: rand(100000, 1000000),
    flow_packets_per_sec: rand(1000, 10000),
    fwd_packet_len_mean: rand(10, 50),
    bwd_packet_len_mean: rand(0, 10),
    syn_flag_count: randInt(50, 200),
    ack_flag_count: randInt(0, 5),
    psh_flag_count: randInt(0, 5),
    rst_flag_count: randInt(0, 3),
    fin_flag_count: randInt(0, 3),
    fwd_iat_mean: rand(1, 100),
    bwd_iat_mean: rand(0, 50),
    active_mean: rand(50, 500),
    idle_mean: rand(0, 500),
    down_up_ratio: rand(0.0, 0.05),
    avg_packet_size: rand(10, 50),
  }),
  PortScan: () => ({
    flow_duration: rand(10, 1000),
    total_fwd_packets: randInt(1, 5),
    total_bwd_packets: randInt(0, 3),
    flow_bytes_per_sec: rand(10, 500),
    flow_packets_per_sec: rand(1, 20),
    fwd_packet_len_mean: rand(0, 40),
    bwd_packet_len_mean: rand(0, 40),
    syn_flag_count: randInt(1, 3),
    ack_flag_count: randInt(0, 2),
    psh_flag_count: randInt(0, 1),
    rst_flag_count: randInt(1, 3),
    fin_flag_count: randInt(0, 1),
    fwd_iat_mean: rand(1, 100),
    bwd_iat_mean: rand(0, 50),
    active_mean: rand(10, 200),
    idle_mean: rand(0, 200),
    down_up_ratio: rand(0.0, 1.0),
    avg_packet_size: rand(0, 40),
  }),
  BruteForce: () => ({
    flow_duration: rand(5000, 50000),
    total_fwd_packets: randInt(10, 200),
    total_bwd_packets: randInt(10, 200),
    flow_bytes_per_sec: rand(500, 10000),
    flow_packets_per_sec: rand(5, 100),
    fwd_packet_len_mean: rand(30, 200),
    bwd_packet_len_mean: rand(30, 200),
    syn_flag_count: randInt(1, 5),
    ack_flag_count: randInt(5, 50),
    psh_flag_count: randInt(5, 50),
    rst_flag_count: randInt(0, 3),
    fin_flag_count: randInt(1, 5),
    fwd_iat_mean: rand(50, 2000),
    bwd_iat_mean: rand(50, 2000),
    active_mean: rand(200, 5000),
    idle_mean: rand(100, 5000),
    down_up_ratio: rand(0.8, 1.2),
    avg_packet_size: rand(30, 200),
  }),
  WebAttack: () => ({
    flow_duration: rand(500, 20000),
    total_fwd_packets: randInt(5, 50),
    total_bwd_packets: randInt(5, 50),
    flow_bytes_per_sec: rand(200, 8000),
    flow_packets_per_sec: rand(2, 30),
    fwd_packet_len_mean: rand(200, 1500),
    bwd_packet_len_mean: rand(200, 3000),
    syn_flag_count: randInt(1, 3),
    ack_flag_count: randInt(3, 20),
    psh_flag_count: randInt(3, 20),
    rst_flag_count: randInt(0, 2),
    fin_flag_count: randInt(1, 3),
    fwd_iat_mean: rand(100, 3000),
    bwd_iat_mean: rand(100, 3000),
    active_mean: rand(300, 8000),
    idle_mean: rand(200, 8000),
    down_up_ratio: rand(1.0, 5.0),
    avg_packet_size: rand(200, 1500),
  }),
  Botnet: () => ({
    flow_duration: rand(100000, 500000),
    total_fwd_packets: randInt(20, 300),
    total_bwd_packets: randInt(20, 300),
    flow_bytes_per_sec: rand(50, 2000),
    flow_packets_per_sec: rand(1, 10),
    fwd_packet_len_mean: rand(20, 200),
    bwd_packet_len_mean: rand(20, 200),
    syn_flag_count: randInt(0, 2),
    ack_flag_count: randInt(5, 30),
    psh_flag_count: randInt(5, 30),
    rst_flag_count: randInt(0, 2),
    fin_flag_count: randInt(0, 3),
    fwd_iat_mean: rand(1000, 30000),
    bwd_iat_mean: rand(1000, 30000),
    active_mean: rand(1000, 20000),
    idle_mean: rand(5000, 100000),
    down_up_ratio: rand(0.9, 1.1),
    avg_packet_size: rand(20, 200),
  }),
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomTraffic() {
  const types = Object.keys(ATTACK_PROFILES);
  // 정상 트래픽 비율을 높게 설정 (60%)
  const weights = [60, 6, 6, 6, 6, 6, 10];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let idx = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) { idx = i; break; }
  }
  const type = types[idx];
  return ATTACK_PROFILES[type]();
}

async function startProducer(intervalMs = 1000) {
  await producer.connect();
  console.log("Kafka Producer 연결 완료");

  setInterval(async () => {
    const traffic = randomTraffic();
    await producer.send({
      topic: TOPIC,
      messages: [{ value: JSON.stringify(traffic) }],
    });
  }, intervalMs);
}

module.exports = { startProducer };
