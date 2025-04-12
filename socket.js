import { Server } from "socket.io";
import * as dbase from "./utils/db.js";

//! Inicialización del Socket
async function initializeSocket(server) {
  await dbase.initializeDatabase();
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

  const db = dbase.getDatabase();
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
// Para todo lo que sean returns, se utilizará returnX
async function registerSocketHandlers(socket, io) {
  const playerId = socket.playerId;

  socket.on("general:getData", () => sendGeneralData(socket));

  socket.on("player:getAllPlayersData", () => getAllPlayersData(socket, true, false));
  socket.on("player:getLinks", async () => sendLinks(socket));
  socket.on("player:setName", async (name) => {
    handleNameChange(io, socket.playerId, name);
  });

  socket.on("game:reset", async () => resetGameData(io));
  socket.on("game:spin", async () => gameSpin(io));
  socket.on("game:setAssignedScores", async (data) => handleScoreAddition(data, io));
  socket.on("game:getAssignedScores", async () => {
    const data = await dbase.getAssignedScores(playerId);
    socket.emit("game:returnAssignedScores", { assignedScores: data });
  });
  socket.on("game:getCurrentPlayer", async () => {
    const data = await dbase.getCurrentPlayer();
    socket.emit("game:returnCurrentPlayer", { playerId: data });
  });
  socket.on(
    "game:setCurrentPlayer",
    async () =>
      await dbase.setCurrentPlayer().then(async () => {
        const data = await dbase.getCurrentPlayer();
        io.emit("game:returnCurrentPlayer", { playerId: data });
      })
  );
}

//! Funciones auxiliares del socket

async function sendGeneralData(socket) {
  var data = await dbase.getDatabase();
  const currentPlayerPosition = await dbase.getCurrentPlayer();
  socket.emit("general:returnData", {
    players: data.data.players,
    game: { ...data.data.game, currentPlayer: currentPlayerPosition },
  });
}

async function sendGameData(socket) {
  const db = dbase.getDatabase();
  const gameData = db.data.game;
  socket.emit("game:returnGameData", gameData);
}

async function sendLinks(socket) {
  const db = dbase.getDatabase();
  const players = db.data.players;
  socket.emit("player:returnLinks", { players: players });
}

async function getAllPlayersData(socket, updateVdo, isNameChange) {
  const db = dbase.getDatabase();
  const players = db.data.players;
  if (isNameChange) {
    socket.emit("player:returnPlayerNameChange", { players: players, updateVdo: updateVdo });
  } else {
    socket.emit("player:returnAllPlayersData", { players: players, updateVdo: updateVdo });
  }
}

async function resetGameData(socket) {
  await dbase.generateGameData();
  sendGameData(socket);
  socket.emit("game:returnReset");
  const players = await dbase.getAllPlayers();
  for (const player of players) {
    socket.emit("game:returnScore", { playerId: player.id, score: 0 });
  }
}

async function gameSpin(socket) {
  await dbase.resetAfterSpin();
  const data = await dbase.getGameState();
  const imageList = data.images || [];
  const remainingImages = data.remainingImages || [];
  const selectedImages = data.selectedImages || [];
  let previousSelectedImages = selectedImages;

  if (!previousSelectedImages || previousSelectedImages.length === 0) {
    previousSelectedImages = Array(4).fill("GENERAL.avif");
  }

  const selected = getRandomImages(remainingImages, 4);
  const hasMoreRounds = remainingImages.length - 4 >= 4;
  const currentRound = (data.currentRound || 0) + 1;
  const spinData = selected.map((finalImage, index) => {
    const fillerImages = getRandomImages(
      imageList.filter((img) => img !== finalImage),
      15
    );
    fillerImages[0] = previousSelectedImages[index];
    fillerImages.push(finalImage);
    return fillerImages;
  });

  socket.emit("game:returnSpin", {
    spinData,
    selected,
    hasMoreRounds,
    currentRound,
    remainingImages: remainingImages.length - 4,
  });

  dbase.updateSelectedImages(selected);
  dbase.updateRemainingImages();
  dbase.updateCurrentRound();
}

async function handleNameChange(socket, playerId, name) {
  await dbase.updatePlayerName(playerId, name.name).then(async () => {
    await getAllPlayersData(socket, false, true);
  });
}

async function handleScoreAddition(data, socket) {
  const playerId = data.playerIdFunc;
  await dbase.addScore(playerId);
  const score = await dbase.getPlayerScore(playerId);
  socket.emit("game:returnScore", { playerId: playerId, score: score });
}

//! Funciones auxiliares generales
function getRandomImages(remainingImages, count) {
  const shuffled = remainingImages.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default initializeSocket;
