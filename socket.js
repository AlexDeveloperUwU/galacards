import { nanoid } from "nanoid";
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

  // Mensaje para generar los datos de los jugadores
  socket.on("generatePlayerData", async () => {
    const players = await generatePlayerData(socket);
    socket.emit("generatedPlayerData", players);
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

// Función para generar los datos de los jugadores
async function generatePlayerData(socket) {
  db.data.players = [];
  // Generar host
  const hostId = nanoid(8);
  const isLocalhost = socket.handshake.headers.host.includes("localhost");
  const protocol = isLocalhost ? "http" : "https";
  const host = {
    id: hostId,
    vdoUrl: `https://vdo.ninja/?push=${hostId}&webcam&bitrate=10000&aspectratio=0.75167&quality=1&stereo=1&autostart&device=1&room=glykroompush`,
    name: "Host",
  };
  db.data.players.push(host);

  // Generar jugadores
  for (let i = 1; i <= 4; i++) {
    const pId = nanoid(8);
    const player = {
      id: pId,
      playerUrl: `${protocol}://${socket.handshake.headers.host}/player?id=${pId}`,
      vdoUrl: `https://vdo.ninja/?push=${pId}&webcam&bitrate=10000&aspectratio=0.75167&quality=1&stereo=1&autostart&device=1&room=glykroompush`,
      name: `Jugador ${i}`,
      score: 0,
    };
    db.data.players.push(player);
  }

  await db.write();
  return db.data.players;
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
