const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Godot Chat Server Online");
});

const wss = new WebSocket.Server({ server });

// ----------------------
// DATA
// ----------------------
const clients = new Map(); // ws => { username }
let chatHistory = [];

const MAX_MESSAGES = 200;

// ----------------------
// HELPERS
// ----------------------
function broadcast(data) {
  const msg = JSON.stringify(data);

  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function sanitizeName(name) {
  if (!name) return "Guest";
  return name.toString().slice(0, 20).trim();
}

// ----------------------
// CONNECTION
// ----------------------
wss.on("connection", (ws) => {
  clients.set(ws, { username: "Guest" });

  console.log("Player connected:", clients.size);

  // 🔥 STEP 1: SEND HISTORY IMMEDIATELY
  ws.send(JSON.stringify({
    type: "history",
    messages: chatHistory
  }));

  // 🔥 STEP 2: SYSTEM MESSAGE
  broadcast({
    type: "system",
    message: `Player joined (${clients.size} online)`
  });

  // ----------------------
  // MESSAGE HANDLING
  // ----------------------
  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw);

      // ----------------------
      // SET NAME
      // ----------------------
      if (data.type === "set_name") {
        const user = clients.get(ws);
        user.username = sanitizeName(data.username);
        clients.set(ws, user);

        console.log("Name set:", user.username);
        return;
      }

      // ----------------------
      // CHAT MESSAGE
      // ----------------------
      if (data.type === "chat") {
        const user = clients.get(ws);

        const messageData = {
          type: "chat",
          username: user?.username || "Guest",
          message: (data.message || "").toString().slice(0, 200).trim()
        };

        if (!messageData.message) return;

        // add to history
        chatHistory.push(messageData);

        // keep only last 200 messages (rolling buffer)
        if (chatHistory.length > MAX_MESSAGES) {
          chatHistory.shift();
        }

        // broadcast to all clients
        broadcast(messageData);
      }

    } catch (err) {
      console.log("Invalid message ignored");
    }
  });

  // ----------------------
  // DISCONNECT
  // ----------------------
  ws.on("close", () => {
    clients.delete(ws);

    console.log("Player disconnected:", clients.size);

    broadcast({
      type: "system",
      message: `Player left (${clients.size} online)`
    });
  });
});

// ----------------------
// START SERVER
// ----------------------
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
