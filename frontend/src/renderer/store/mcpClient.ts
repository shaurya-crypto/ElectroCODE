// MCP Server WebSocket Hub for Electro CODE

let socket: WebSocket | null = null;
let retryTimeout: any = null;
let pingInterval: any = null;
export let currentSessionId: string | null = null;

// Subscribers for specific MCP events
type Subscriber = (data: any) => void;
const subscribers: Record<string, Subscriber[]> = {
  anomaly_detected: [],
  ai_stream_chunk: [],
};

export function connectMcp() {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;

  socket = new WebSocket("ws://127.0.0.1:4000");

  socket.onopen = () => {
    console.log("Connected to MCP Server");
    // Start PING interval (every 20s)
    pingInterval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "PING" }));
      }
    }, 20000);
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      
      // Capture Handshake
      if (payload.type === "SESSION_ESTABLISHED") {
        currentSessionId = payload.data.sessionId;
        console.log("MCP Session ID:", currentSessionId);
      }
      // Subscribers
      else if (payload.type && subscribers[payload.type]) {
        subscribers[payload.type].forEach(cb => cb(payload.data));
      }
    } catch { }
  };

  socket.onclose = () => {
    console.log("Disconnected from MCP Server. Reconnecting in 3s...");
    socket = null;
    currentSessionId = null;
    clearInterval(pingInterval);
    clearTimeout(retryTimeout);
    retryTimeout = setTimeout(connectMcp, 3000);
  };

  socket.onerror = () => {
    socket?.close();
  };
}

export function subscribeToMcp(type: string, callback: Subscriber) {
  if (!subscribers[type]) subscribers[type] = [];
  subscribers[type].push(callback);
}

export function sendMcpEvent(type: string, data: any) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, data }));
  }
}

// Global initialization
connectMcp();
