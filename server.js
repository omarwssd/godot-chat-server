const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Godot Chat Server Online");
});

const wss = new WebSocket.Server({ server });

// Store client data properly
const clients = new Map();
// ws => { username }

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

wss.on("connection", (ws) => {
  // default user
  clients.set(ws, { username: "Guest" });

  console.log("Player connected:", clients.size);

  ws.send(JSON.stringify({
    type: "system",
    message: "Connected to global chat"
  }));

  broadcast({
    type: "system",
    message: `Player joined (${clients.size} online)`
  });

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw);

      // -------------------------
      // SET USERNAME (from AccountManager)
      // -------------------------
      if (data.type === "set_name") {
        const user = clients.get(ws) || {};
        user.username = sanitizeName(data.username);
        clients.set(ws, user);

        console.log("Name set:", user.username);
        return;
      }

      // -------------------------
      // CHAT MESSAGE
      // -------------------------
      if (data.type === "chat") {
        const user = clients.get(ws);

        const message = (data.message || "")
          .toString()
          .slice(0, 200)
          .trim();

        if (!message) return;

        broadcast({
          type: "chat",
          username: user?.username || "Guest",
          message: message
        });
      }

    } catch (err) {
      console.log("Invalid message ignored");
    }
  });

  ws.on("close", () => {
    clients.delete(ws);

    console.log("Player disconnected:", clients.size);

    broadcast({
      type: "system",
      message: `Player left (${clients.size} online)`
    });
  });
});

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
