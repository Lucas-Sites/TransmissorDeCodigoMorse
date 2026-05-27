const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.static(path.join(__dirname, "../frontend")));

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
  return Array.from(room.users.values()).map(u => u.name);
}

function emitRoomUsers(roomCode) {
  io.to(roomCode).emit("room-users", getRoomUsers(roomCode));
}

io.on("connection", (socket) => {
  socket.on("create-room", (name) => {
    let code;
    do {
      code = generateRoomCode();
    } while (rooms.has(code));
    rooms.set(code, { users: new Map() });
    socket.join(code);
    rooms.get(code).users.set(socket.id, { name: name || "Anônimo" });
    socket.emit("room-created", code);
    emitRoomUsers(code);
  });

  socket.on("join-room", (code, name) => {
    const room = rooms.get(code);
    if (!room) {
      socket.emit("error", "Sala não encontrada");
      return;
    }
    socket.join(code);
    room.users.set(socket.id, { name: name || "Anônimo" });
    socket.emit("joined-room", code);
    socket.to(code).emit("user-joined", name || "Anônimo");
    emitRoomUsers(code);
  });

  socket.on("morse-signal", (code) => {
    socket.to(code).emit("morse-signal");
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        socket.to(code).emit("user-left", user.name);
        emitRoomUsers(code);
        if (room.users.size === 0) {
          rooms.delete(code);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

