const http = require("http");
const WebSocket = require("ws");

// Basic HTTP server (required for Render health checks)
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Godot Global Chat Server Online");
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
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

// Handle connections
wss.on("connection", (ws) => {
  clients.set(ws, { username: "Guest" });

  console.log("Player connected:", clients.size);

  // Send welcome
  ws.send(JSON.stringify({
    type: "system",
    message: "Connected to global chat"
  }));

  // Broadcast join
  broadcast({
    type: "system",
    message: `A player joined (${clients.size} online)`
  });

  // Receive messages
  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw);

      // Set username once
      if (data.type === "set_name") {
        const user = clients.get(ws);
        user.username = (data.username || "Guest").slice(0, 20);
        clients.set(ws, user);
        return;
      }

      // Chat message
      if (data.type === "chat") {
        const user = clients.get(ws);

        const message = (data.message || "").toString().slice(0, 200);

        if (!message.trim()) return;

        broadcast({
          type: "chat",
          username: user.username,
          message: message
        });
      }

    } catch (err) {
      console.log("Bad message ignored");
    }
  });

  // Disconnect
  ws.on("close", () => {
    clients.delete(ws);

    console.log("Player disconnected:", clients.size);

    broadcast({
      type: "system",
      message: `A player left (${clients.size} online)`
    });
  });
});

// Start server
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});