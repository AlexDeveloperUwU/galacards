import { Server } from "socket.io";
import { initializeDatabase, getDatabase, savePlayerName } from "./utils/db.js";

//! Inicialización del Socket
async function initializeSocket(server) {
  await initializeDatabase();
  const io = new Server(server);

  io.use(authenticateSocket);
  io.on("connection", (socket) => {
    console.log(`Cliente autenticado. Socket ID: ${socket.id} Player ID: ${socket.playerId}`);
    registerSocketHandlers(socket);
  });
}

//! Middleware de autenticación
function authenticateSocket(socket, next) {
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
}

//! Registro de eventos del Socket
async function registerSocketHandlers(socket) {
  const playerId = socket.playerId;

  socket.on("getPlayerData", () => sendPlayerData(socket));
  socket.on("getPlayerLinks", () => sendPlayerLinks(socket));
  socket.on("savePlayerName", async (data) => {
    await savePlayerName(playerId, data.name);
    sendPlayerData(socket);
  });
  socket.on("spin", () => handleSpin(socket));
  socket.on("resetImageLists", () => handleResetImageLists(socket));
  socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id));
}

//! Funciones auxiliares para eventos del Socket

// Enviar datos de los jugadores al cliente
async function sendPlayerData(socket) {
  const db = getDatabase();
  const players = db.data.players;
  socket.emit("playerData", players);
}

// Enviar enlaces de los jugadores al cliente
function sendPlayerLinks(socket) {
  const db = getDatabase();
  const players = db.data.players || [];
  const playerLinks = players.map(({ name, vdoUrl, gameUrl }) => ({ name, vdoUrl, gameUrl }));
  socket.emit("playerLinks", playerLinks);
}

// Manejar el evento "spin"
function handleSpin(socket) {
  const db = getDatabase();
  const imageList = db.data.game.images || [];
  const remainingImages = db.data.game.remainingImages;

  if (remainingImages.length < 4) {
    socket.emit("spinResult", { error: "No hay suficientes imágenes restantes." });
    return;
  }

  const selectedImages = getRandomImages(remainingImages, 4);
  const spinData = selectedImages.map((finalImage) => {
    const fillerImages = getRandomImages(
      imageList.filter((img) => img !== finalImage),
      14
    );
    return [...fillerImages, finalImage];
  });

  db.data.game.remainingImages = remainingImages.filter((img) => !selectedImages.includes(img));
  const hasMoreRounds = db.data.game.remainingImages.length >= 4;

  db.write().then(() => {
    socket.emit("spinResult", { spinData, selectedImages, hasMoreRounds });
  });
}

// Manejar el evento "resetImageLists"
function handleResetImageLists(socket) {
  const db = getDatabase();
  db.data.game.remainingImages = [...db.data.game.images];
  db.write().then(() => {
    socket.emit("resetComplete");
  });
}

//! Utilidades generales

// Seleccionar imágenes aleatorias
function getRandomImages(array, count) {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default initializeSocket;
