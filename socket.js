import { Server } from "socket.io";
import * as dbase from "./utils/db.js";
import { sendDiscordWebhook } from "send-discord-webhook";
import { readFile } from "fs/promises";

const data = await readFile("./config/config.json", "utf-8");
const config = JSON.parse(data);

//! Inicialización del Socket
async function initializeSocket(server) {
  await dbase.initializeDatabase();
  const io = new Server(server);

  io.use(authenticateSocket);
  io.on("connection", async (socket) => {
    console.log(`Cliente autenticado. Auth ID: ${socket.playerId}`);

    // Ejecuta handleConnection de forma asíncrona sin bloquear el flujo
    handleConnection(socket, io, "connect").catch(console.error);

    // Continúa inmediatamente con el registro de manejadores
    registerSocketHandlers(socket, io);
  });
}

//! Middleware de autenticación
function authenticateSocket(socket, next) {
  let playerId = socket.handshake.auth.id;

  if (!playerId) {
    console.log("Desconectando: falta el ID de autenticación");
    socket.disconnect(true);
    return;
  }

  const basePlayerId = playerId.replace("-ac", "");

  if (basePlayerId === "obs") {
    socket.playerId = playerId;
    next();
    return;
  }

  const db = dbase.getDatabase();
  const player = db.data.players.find((p) => p.id === basePlayerId);
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

  socket.on("ac:getAllConnected", () => sendAllConnectedAc(socket));
  socket.on("ac:youtubeDetected", async (data) => handleYouTubeDetected(data, socket));

  socket.on("disconnect", async () => {
    console.log(`Cliente desconectado. Auth ID: ${socket.playerId}`);
    await handleConnection(socket, io, "disconnect");
  });
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

//! Funciones de conexión y desconexión

async function handleConnection(socket, io, type) {
  const players = await dbase.getAllPlayers();
  if (socket.playerId !== "obs" && socket.playerId !== players[0].id) {
    const basePlayerId = socket.playerId.replace("-ac", "");
    const player = players.find((p) => p.id === basePlayerId);
    const playerName = player ? player.name : "Desconocido";
    const timestamp = Math.floor(Date.now() / 1000);

    if (type === "connect") {
      if (socket.playerId.includes("-ac")) {
        sendDiscordWebhook({
          url: config.djsWebhook,
          content: `El anticheat del jugador con ID ${socket.playerId} (${playerName}) se ha conectado. (Timestamp: <t:${timestamp}:T>)`,
        }).catch(console.error);

        io.emit("ac:playerCheatClean", { playerId: basePlayerId });
      } else {
        sendDiscordWebhook({
          url: config.djsWebhook,
          content: `Jugador con ID ${socket.playerId} (${playerName}) se ha conectado. (Timestamp: <t:${timestamp}:T>)`,
        }).catch(console.error);
      }
    }

    if (type === "disconnect") {
      if (socket.playerId.includes("-ac")) {
        sendDiscordWebhook({
          url: config.djsWebhook,
          content: `El anticheat del jugador con ID ${socket.playerId} (${playerName}) se ha desconectado. (Timestamp: <t:${timestamp}:T>)`,
        }).catch(console.error);

        io.emit("ac:playerCheatDetected", { playerId: basePlayerId });
      } else {
        sendDiscordWebhook({
          url: config.djsWebhook,
          content: `Jugador con ID ${socket.playerId} (${playerName}) se ha desconectado. (Timestamp: <t:${timestamp}:T>)`,
        }).catch(console.error);
      }
    }
  }
}

function sendAllConnectedAc(socket) {
  const connectedClients = [];
  const sockets = Array.from(socket.server.sockets.sockets.values());

  sockets.forEach((clientSocket) => {
    if (clientSocket.playerId && clientSocket.playerId.includes("-ac")) {
      connectedClients.push(clientSocket.playerId);
    }
  });

  socket.emit("ac:returnAllConnected", { connectedClients });
}

async function handleYouTubeDetected(data, socket) {
  const players = await dbase.getAllPlayers();
  const playerId = socket.playerId.replace("-ac", "");
  const player = players.find((p) => p.id === playerId);
  const playerName = player ? player.name : "Desconocido";
  const timestamp = Math.floor(Date.now() / 1000);

  await sendDiscordWebhook({
    url: config.djsWebhook,
    content: `El jugador ${playerName} (${socket.playerId}) ha abierto YouTube. [(URL)](${data.url}) (Timestamp: <t:${timestamp}:T>)`,
  });

  socket.emit("ac:returnYouTubeDetected", { playerId });
}

export default initializeSocket;
