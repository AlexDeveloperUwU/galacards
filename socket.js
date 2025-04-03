import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { JSONFilePreset } from "lowdb/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, "data", "db.json");
const defaultData = { players: [] };
let db;

async function initializeDatabase() {
  db = await JSONFilePreset(dbFile, defaultData);
}

//! Función para gestionar los mensajes del socket
async function registerSocketHandlers(socket) {
  console.log(`Cliente conectado. Socket ID: ${socket.id} Player ID: ${socket.handshake.query.id}`);

  // Mensaje para obtener los datos de los jugadores
  socket.on("getPlayerData", () => {
    sendPlayerData(socket);
  });

  // Mensaje para guardar el nombre del jugador
  socket.on("savePlayerName", async (data) => {
    const { playerId, name } = data;
    await savePlayerName(playerId, name);
    sendPlayerData(socket);
  });

  // Mensaje para cuando se desconecta un jugador
  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
}

async function initializeSocket(server) {
  await initializeDatabase();
  const io = new Server(server);

  io.on("connection", (socket) => {
    sendPlayerData(socket);
    registerSocketHandlers(socket);
  });
}

//! Funciones auxiliares para el Socket

// Función para enviar los datos de los jugadores al cliente
async function sendPlayerData(socket) {
  const players = db.data.players;
  socket.emit("playerData", players);
}

// Función para guardar el nombre del jugador
async function savePlayerName(playerId, name) {
  const player = db.data.players.find((p) => p.id === playerId);
  if (player) {
    player.name = name;
    await db.write();
  }
}

export default initializeSocket;
