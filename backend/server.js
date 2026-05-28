const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "morse-transmitter-backend" });
});

const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getRoomUsers(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return [];
  return Array.from(room.clients.values()).map(c => c.name);
}

function emitRoomUsers(roomCode) {
  const users = getRoomUsers(roomCode);
  broadcast(roomCode, { type: "room-users", users });
}

function broadcast(roomCode, message, excludeWs = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const [clientWs] of room.clients) {
    if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  }
}

function emitTo(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

wss.on("connection", (ws) => {
  ws.clientData = { name: null, room: null };

  ws.on("message", (rawData) => {
    try {
      const msg = JSON.parse(rawData);

      if (msg.type === "create-room") {
        let code;
        do {
          code = generateRoomCode();
        } while (rooms.has(code));
        rooms.set(code, { clients: new Map() });
        rooms.get(code).clients.set(ws, { name: msg.name || "Anônimo" });
        ws.clientData.room = code;
        ws.clientData.name = msg.name || "Anônimo";
        emitTo(ws, { type: "room-created", code });
        emitRoomUsers(code);
      }

      else if (msg.type === "join-room") {
        const room = rooms.get(msg.code);
        if (!room) {
          emitTo(ws, { type: "error", message: "Sala não encontrada" });
          return;
        }
        room.clients.set(ws, { name: msg.name || "Anônimo" });
        ws.clientData.room = msg.code;
        ws.clientData.name = msg.name || "Anônimo";
        emitTo(ws, { type: "joined-room", code: msg.code });
        broadcast(msg.code, { type: "user-joined", name: msg.name || "Anônimo" }, ws);
        emitRoomUsers(msg.code);
      }

      else if (msg.type === "morse-signal") {
        if (ws.clientData.room) {
          broadcast(ws.clientData.room, { type: "morse-signal" }, ws);
        }
      }
    } catch (e) {
      console.error("Invalid message:", rawData);
    }
  });

  ws.on("close", () => {
    const roomCode = ws.clientData.room;
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      const clientInfo = room.clients.get(ws);
      room.clients.delete(ws);
      if (clientInfo) {
        broadcast(roomCode, { type: "user-left", name: clientInfo.name });
      }
      emitRoomUsers(roomCode);
      if (room.clients.size === 0) {
        rooms.delete(roomCode);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
