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
const clients = new Map(); 
// ws => { username }

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

// find player by name
function findClientByName(name) {
  for (const [ws, data] of clients) {
    if (data.username === name) {
      return ws;
    }
  }
  return null;
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

  // send history
  ws.send(JSON.stringify({
    type: "history",
    messages: chatHistory
  }));

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
        const user = clients.get(ws);
        user.username = sanitizeName(data.username);
        clients.set(ws, user);

        console.log("Name set:", user.username);
        return;
      }

      // ----------------------
      // GLOBAL CHAT
      // ----------------------
      if (data.type === "chat") {
        const user = clients.get(ws);

        const messageData = {
          type: "chat",
          username: user?.username || "Guest",
          message: data.message
        };

        chatHistory.push(messageData);

        if (chatHistory.length > MAX_MESSAGES) {
          chatHistory.shift();
        }

        broadcast(messageData);
        return;
      }

      // ----------------------
      // PRIVATE MESSAGE (DM)
      // ----------------------
      if (data.type === "dm") {
        const fromUser = clients.get(ws)?.username || "Guest";
        const targetName = data.to;
        const message = data.message;

        const targetWs = findClientByName(targetName);

        if (!targetWs) {
          ws.send(JSON.stringify({
            type: "system",
            message: "User not found: " + targetName
          }));
          return;
        }

        const dmData = {
          type: "dm",
          from: fromUser,
          message: message
        };

        // send ONLY to target
        targetWs.send(JSON.stringify(dmData));

        // optional: echo back to sender
        ws.send(JSON.stringify({
          type: "dm",
          from: "You → " + targetName,
          message: message
        }));

        console.log(`DM: ${fromUser} → ${targetName}: ${message}`);
        return;
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
// START
// ----------------------
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
