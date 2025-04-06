import { Server } from "socket.io";
import { initializeDatabase, getDatabase, savePlayerName } from "./utils/db.js";

//! Función para gestionar los mensajes del socket
async function registerSocketHandlers(socket) {
  const playerId = socket.playerId;
  console.log(`Cliente conectado. Socket ID: ${socket.id} Player ID: ${playerId}`);

  // Función para enviar los datos al cliente
  socket.on("getPlayerData", () => {
    sendPlayerData(socket);
  });

  // Función para enviar los enlaces de los jugadores
  socket.on("getPlayerLinks", () => {
    const db = getDatabase();
    const players = db.data.players || [];

    const playerLinks = players.map((player) => {
      return {
        name: player.name,
        vdoUrl: player.vdoUrl,
        gameUrl: player.gameUrl,
      };
    });

    socket.emit("playerLinks", playerLinks);
  });

  // Función para guardar el nombre del jugador
  socket.on("savePlayerName", async (data) => {
    const { name } = data;
    await savePlayerName(playerId, name);
    sendPlayerData(socket);
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
}

//! Función para inicializar el socket
async function initializeSocket(server) {
  await initializeDatabase();
  const io = new Server(server);

  io.use((socket, next) => {
    const playerId = socket.handshake.auth.id;

    if (!playerId) {
      console.log("Desconectando: falta el ID de autenticación");
      socket.disconnect(true);
      return;
    }

    const db = getDatabase();
    const player = db.data.players.find((p) => p.id === playerId);
    if (!player) {
      console.log(`Desconectando: ID de autenticación no válido (${playerId})`);
      socket.disconnect(true);
      return;
    }

    socket.playerId = playerId;
    next();
  });

  io.on("connection", (socket) => {
    console.log(`Cliente autenticado. Socket ID: ${socket.id} Player ID: ${socket.playerId}`);
    registerSocketHandlers(socket);
  });
}

//! Funciones auxiliares para el Socket

// Función para enviar los datos de los jugadores al cliente
async function sendPlayerData(socket) {
  const db = getDatabase();
  const players = db.data.players;
  socket.emit("playerData", players);
}

export default initializeSocket;
