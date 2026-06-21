const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Godot Chat Server Online");
});

const wss = new WebSocket.Server({ server });

// ----------------------
// CLIENTS
// ----------------------
const clients = new Map(); // ws => { username }

// ----------------------
// CHAT HISTORY (ROLLING BUFFER)
// ----------------------
let chatHistory = [];
const MAX_MESSAGES = 200;

// ----------------------
// BROADCAST FUNCTION
// ----------------------
function broadcast(data) {
  const msg = JSON.stringify(data);

  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// ----------------------
// CLEAN USERNAME
// ----------------------
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

  // Send current chat history
  ws.send(JSON.stringify({
    type: "history",
    messages: chatHistory
  }));

  // System message
  broadcast({
    type: "system",
    message: `Player joined (${clients.size} online)`
  });

  // ----------------------
  // MESSAGE HANDLER
  // ----------------------
  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw);

      // ----------------------
      // SET NAME
      // ----------------------
      if (data.type === "set_name") {
        const user = clients.get(ws) || {};
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

        const message = (data.message || "")
          .toString()
          .slice(0, 200)
          .trim();

        if (!message) return;

        const messageData = {
          type: "chat",
          username: user?.username || "Guest",
          message: message,
          time: Date.now()
        };

        // Add to history
        chatHistory.push(messageData);

        // 🔥 KEEP LAST 200 MESSAGES ONLY (ROLLING BUFFER)
        if (chatHistory.length > MAX_MESSAGES) {
          chatHistory.shift();
        }

        // Broadcast to all players
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
