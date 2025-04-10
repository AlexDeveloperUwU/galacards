import path from "path";
import { fileURLToPath } from "url";
import { JSONFilePreset } from "lowdb/node";
import fs from "fs";
import { customAlphabet } from "nanoid";

////////////////////////////////////////////////////
//
// Sección de configuración y constantes
//
///////////////////////////////////////////////////

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, "..", "data", "db.json");
const imageDir = path.join(__dirname, "..", "web", "public", "images");

const defaultData = {
  players: [],
  game: {
    gameState: "",
    images: [],
    remainingImages: [],
    selectedImages: [],
    totalRounds: 0,
    currentRound: 0,
    currentPlayer: null,
  },
};
let db;

// Crear un nanoid personalizado con letras y números
const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 8);

////////////////////////////////////////////////////
//
// Sección de básicos de la base de datos
//
///////////////////////////////////////////////////

// Inicializar la base de datos
export async function initializeDatabase() {
  db = await JSONFilePreset(dbFile, defaultData);
}

// Obtener la instancia de la base de datos
export function getDatabase() {
  return db;
}

////////////////////////////////////////////////////
//
// Sección de preparación y reset de la database
//
///////////////////////////////////////////////////

// Función para resetear todo el juego
export async function resetApp(gameBaseUrl) {
  await generateGameData();
  await generatePlayerData(gameBaseUrl);
}

// Función para generar los datos de los jugadores
async function generatePlayerData(gameBaseUrl) {
  db.data.players = [];
  const hostId = nanoid();

  const host = {
    id: hostId,
    vdoUrl: `https://vdo.ninja/?push=${hostId}&webcam&bitrate=10000&aspectratio=0.75167&quality=1&stereo=1&device=1`,
    name: "Pulpo a la gallega",
  };
  db.data.players.push(host);

  for (let i = 1; i <= 4; i++) {
    const pId = nanoid();
    const player = {
      id: pId,
      playerUrl: `${gameBaseUrl}/player?id=${pId}`,
      vdoUrl: `https://vdo.ninja/?push=${pId}&webcam&bitrate=10000&aspectratio=0.75167&quality=1&stereo=1&device=1`,
      name: `Jugador ${i}`,
      score: 0,
    };
    db.data.players.push(player);
  }

  await db.write();
}

// Función para generar los datos del juego
// También servirá para reiniciar el juego
export async function generateGameData() {
  try {
    const files = await fs.promises.readdir(imageDir);
    const images = files.filter(
      (file) => file !== "favicon.png" && file !== "LOGO.avif" && file !== "TC.avif" && file !== "GENERAL.avif"
    );
    db.data.game.images = images;
    db.data.game.remainingImages = [...images];
    db.data.game.selectedImages = [];
    db.data.game.currentRound = 0;
    db.data.game.totalRounds = images.length / 4;
    db.data.game.gameState = "waiting";
    db.data.game.currentPlayer = null;
    db.data.game.assignedScores = [];
    await db.write();
  } catch (err) {
    console.error("Error leyendo el directorio de imágenes:", err);
    throw new Error("No se pudo leer las imágenes");
  }
}

////////////////////////////////////////////////////
//
// Sección de gestión de jugadores
//
///////////////////////////////////////////////////

export async function getPlayerInfo(playerId) {
  const player = db.data.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error("Player not found");
  }
  return player;
}

export async function updatePlayerName(playerId, name) {
  console.log("Updating player name:", playerId, name);
  const player = db.data.players.find((p) => p.id === playerId);
  if (player) {
    player.name = typeof name === "string" ? name : player.name;
    await db.write();
  }
}

////////////////////////////////////////////////////
//
// Sección de gestión del juego
//
///////////////////////////////////////////////////

export async function getGameState() {
  return db.data.game || {};
}

export async function updateGameState(newState) {
  db.data.game.gameState = newState;
  await db.write();
}

export async function updateSelectedImages(selectedImages) {
  db.data.game.selectedImages = selectedImages;
  await db.write();
}

export async function updateRemainingImages() {
  db.data.game.remainingImages = db.data.game.remainingImages.filter(
    (img) => !db.data.game.selectedImages.includes(img)
  );
  await db.write();
}

export async function updateCurrentRound() {
  db.data.game.currentRound += 1;
  await db.write();
}

////////////////////////////////////////////////////
//
// Sección de gestión de las puntuaciones
//
///////////////////////////////////////////////////

export async function getPlayerScore(playerId) {
  const player = db.data.players.find((p) => p.id === playerId);
  return player ? player.score : 0;
}

export async function setPlayerScore(playerId, score) {
  const player = db.data.players.find((p) => p.id === playerId);
  if (player) {
    player.score = score;
    await db.write();
  }
}

export async function setAllPlayerScores(score) {
  for (const player of db.data.players) {
    player.score = score;
  }
  await db.write();
}

export async function getAllPlayerScores() {
  return db.data.players.map(({ id, score }) => ({
    id,
    score: typeof score === "object" ? score.score || 0 : score || 0,
  }));
}

export async function getCurrentPlayer() {
  const players = db.data.players.slice(1, 5); 
  const currentPlayerId = db.data.game.currentPlayer;

  if (!currentPlayerId) {
    return null;
  }

  const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
  return currentIndex !== -1 ? currentIndex + 1 : null; 
}

export async function setCurrentPlayer() {
  const players = db.data.players.slice(1, 5);
  const currentPlayer = db.data.game.currentPlayer;

  if (currentPlayer === null) {
    db.data.game.currentPlayer = players[0]?.id || null;
  } else {
    const currentIndex = players.findIndex((p) => p.id === currentPlayer);
    if (currentIndex === -1 || currentIndex === players.length - 1) {
      db.data.game.currentPlayer = null; 
    } else {
      db.data.game.currentPlayer = players[currentIndex + 1]?.id || null;
    }
  }

  await db.write();
}

