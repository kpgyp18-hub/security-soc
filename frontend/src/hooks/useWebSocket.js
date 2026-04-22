import { useEffect, useRef, useState, useCallback } from "react";

export default function useWebSocket(url) {
  const [lastEvent, setLastEvent] = useState(null);
  const [lastAlert, setLastAlert] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === "traffic_event") {
            setLastEvent(payload.data);
          } else if (payload.type === "alert") {
            setLastAlert({ ...payload.data, id: Date.now() });
          }
        } catch {}
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, [url]);

  return { lastEvent, lastAlert, connected };
}
