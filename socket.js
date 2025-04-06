import { Server } from "socket.io";
import { initializeDatabase, getDatabase, savePlayerName } from "./utils/db.js";

//! Función para gestionar los mensajes del socket
async function registerSocketHandlers(socket) {
  const playerId = socket.playerId;

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

  // Manejar el evento de "spin"
  socket.on("spin", () => {
    handleSpin(socket);
  });

  socket.on("resetImageLists", () => {
    console.log("Resetting image lists...");
    handleResetImageLists(socket);
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

// Función auxiliar para seleccionar imágenes aleatorias
function getRandomImages(array, count) {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Función auxiliar para manejar el evento "spin"
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

// Función auxiliar para manejar el evento "resetImageLists"
function handleResetImageLists(socket) {
  console.log("Resetting image lists...");
  const db = getDatabase();
  db.data.game.remainingImages = [...db.data.game.images];
  db.write().then(() => {
    socket.emit("resetComplete");
  });
}

export default initializeSocket;
