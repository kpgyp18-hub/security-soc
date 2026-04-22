const { Kafka } = require("kafkajs");
const axios = require("axios");
const { insertEvent } = require("../db");
const alertManager = require("../alerts/alertManager");
require("dotenv").config({ path: "../.env" });

const kafka = new Kafka({
  clientId: "soc-consumer",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || "soc-consumer-group",
});

const TOPIC = process.env.KAFKA_TOPIC || "network-traffic";
const ML_URL = process.env.ML_SERVER_URL || "http://localhost:8000";

let broadcast = null;

function setBroadcast(fn) {
  broadcast = fn;
  alertManager.setBroadcast(fn);
}

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  console.log("Kafka Consumer 연결 완료");

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const traffic = JSON.parse(message.value.toString());

        const { data: prediction } = await axios.post(`${ML_URL}/predict`, traffic);

        const event = {
          ...traffic,
          label: prediction.label,
          confidence: prediction.confidence,
          probabilities: prediction.probabilities,
        };

        const saved = await insertEvent(event);

        if (broadcast) {
          broadcast({ type: "traffic_event", data: saved });
        }

        // 공격 탐지 시 알림 임계값 체크
        if (prediction.label !== "BENIGN") {
          alertManager.check(prediction.label);
        }
      } catch (err) {
        console.error("Consumer 처리 오류:", err.message);
      }
    },
  });
}

module.exports = { startConsumer, setBroadcast };
