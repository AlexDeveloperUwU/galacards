import { Server } from "socket.io";
import { initializeDatabase, getDatabase, savePlayerName, getGameState, updateGameRound, getPlayerScore, getAllPlayerScores, setPlayerScore, setAllPlayerScores } from "./utils/db.js";

//! Inicialización del Socket
async function initializeSocket(server) {
  await initializeDatabase();
  const io = new Server(server);

  io.use(authenticateSocket);
  io.on("connection", (socket) => {
    console.log(`Cliente autenticado. Socket ID: ${socket.id} Player ID: ${socket.playerId}`);
    registerSocketHandlers(socket, io);
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
async function registerSocketHandlers(socket, io) {
  const playerId = socket.playerId;

  socket.on("player:getData", () => sendPlayerData(socket));
  socket.on("player:getLinks", () => sendPlayerLinks(socket));
  socket.on("game:getState", () => sendGameState(socket));
  socket.on("player:updateName", async (data) => {
    await savePlayerName(playerId, data.name);
    sendPlayerData(socket);
  });
  socket.on("game:spin", () => handleSpin(socket));
  socket.on("game:reset", () => handleResettingGame(socket));
  socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id));

  // Manejadores para puntuaciones
  socket.on("score:get", ({ playerId: targetId }) => {
    const score = getPlayerScore(targetId || playerId);
    socket.emit("score:update", { playerId: targetId || playerId, score });
  });

  socket.on("score:getAll", () => {
    const scores = getAllPlayerScores();
    socket.emit("score:updateAll", scores);
  });

  socket.on("score:set", async ({ playerId: targetId, score }) => {
    if (await setPlayerScore(targetId || playerId, score)) {
      const updatedScore = getPlayerScore(targetId || playerId);
      io.emit("score:update", { playerId: targetId || playerId, score: updatedScore });
    }
  });

  socket.on("score:setAll", async (scores) => {
    await setAllPlayerScores(scores);
    const updatedScores = getAllPlayerScores();
    io.emit("score:updateAll", updatedScores);
  });
}

//! Funciones auxiliares para eventos del Socket

// Enviar datos de los jugadores al cliente
async function sendPlayerData(socket) {
  const db = getDatabase();
  const players = db.data.players;
  socket.emit("player:data", players);
}

// Enviar enlaces de los jugadores al cliente
function sendPlayerLinks(socket) {
  const db = getDatabase();
  const players = db.data.players || [];
  const playerLinks = players.map(({ name, vdoUrl, gameUrl }) => ({ name, vdoUrl, gameUrl }));
  socket.emit("player:links", playerLinks);
}

// Enviar el estado del juego al cliente
function sendGameState(socket) {
  const gameState = getGameState();
  socket.emit("game:state", gameState);

  const db = getDatabase();
  const imageList = db.data.game.images || [];
  const currentRound = (db.data.game.currentRound || 0);
  const totalRounds = Math.ceil(imageList.length / 4);
  socket.emit("game:round", {
    currentRound,
    remainingCards: db.data.game.remainingImages.length,
    totalRounds,
  });
}

// Manejar el evento "spin"
function handleSpin(socket) {
  const db = getDatabase();
  const imageList = db.data.game.images || [];
  const remainingImages = db.data.game.remainingImages;

  if (remainingImages.length < 4) {
    socket.emit("game:spinResult", { error: "No hay suficientes imágenes restantes." });
    return;
  }

  let previousSelectedImages = db.data.game.lastSelectedImages;
  if (!previousSelectedImages || previousSelectedImages.length === 0) {
    previousSelectedImages = Array(4).fill("GENERAL.avif");
  }

  const selectedImages = getRandomImages(remainingImages, 4);

  const spinData = selectedImages.map((finalImage, index) => {
    const fillerImages = getRandomImages(
      imageList.filter((img) => img !== finalImage),
      15
    );
    fillerImages[0] = previousSelectedImages[index];
    fillerImages.push(finalImage);
    return fillerImages;
  });

  db.data.game.remainingImages = remainingImages.filter((img) => !selectedImages.includes(img));
  db.data.game.lastSelectedImages = selectedImages;
  const hasMoreRounds = db.data.game.remainingImages.length >= 4;

  const currentRound = (db.data.game.currentRound || 0) + 1;
  const totalRounds = Math.ceil(imageList.length / 4);
  
  updateGameRound(currentRound, totalRounds).then(() => {
    socket.emit("game:spinResult", { spinData, selectedImages, hasMoreRounds });
    socket.emit("game:round", {
      currentRound,
      remainingCards: db.data.game.remainingImages.length,
      totalRounds,
    });
  });
}

function handleSpin(socket) {
  
  updateGameRound(currentRound, totalRounds).then(() => {
    socket.emit("game:spinResult", { spinData, selectedImages, hasMoreRounds });
    socket.emit("game:round", {
      currentRound,
      remainingCards: db.data.game.remainingImages.length,
      totalRounds,
    });
  });
}

// Manejar el evento "handleResettingGame"
async function handleResettingGame(socket) {
  const db = getDatabase();
  db.data.game.remainingImages = [...db.data.game.images];
  db.data.game.lastSelectedImages = [];
  db.data.game.currentRound = 0;
  db.data.game.totalRounds = Math.ceil(db.data.game.images.length / 4);
  await setAllPlayerScores(0);
  const updatedScores = getAllPlayerScores();
  db.write().then(() => {
    socket.emit("game:resetComplete");
    socket.emit("score:updateAll", updatedScores);
    socket.emit("game:round", {
      currentRound: 0,
      remainingCards: db.data.game.images.length,
      totalRounds: Math.ceil(db.data.game.images.length / 4),
    });
  });
}

//! Utilidades generales

// Seleccionar imágenes aleatorias
function getRandomImages(array, count) {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default initializeSocket;
