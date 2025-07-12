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
    presentation: {
      active: false,
      currentPresenter: null,
      stage: 0, // 0: todos visibles, 1-4: jugador específico + host
    },
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
    vdoUrl: `https://vdo.ninja/?push=${hostId}&webcam&outboundvideobitrate=2000&maxvideobitrate=2000&maxbandwidth=10000&videobitrate=2000&quality=1&width=390&height=520&contenthint=motion&maxframerate=60&quality=1&stereo=1`,
    name: "Pulpo a la gallega",
  };
  db.data.players.push(host);

  for (let i = 1; i <= 4; i++) {
    const pId = nanoid();
    const player = {
      id: pId,
      playerUrl: `${gameBaseUrl}/?id=${pId}`,
      vdoUrl: `https://vdo.ninja/?push=${pId}&webcam&outboundvideobitrate=2000&maxvideobitrate=2000&maxbandwidth=10000&videobitrate=2000&quality=1&width=390&height=520&contenthint=motion&maxframerate=60&quality=1&stereo=1`,
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
    await setAllPlayerScores(0);
    await db.write();
  } catch (err) {
    console.error("Error leyendo el directorio de imágenes:", err);
    throw new Error("No se pudo leer las imágenes");
  }
}

export async function resetAfterSpin() {
  db.data.game.currentPlayer = null;
  db.data.game.assignedScores = [];
  db.write();
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

export async function getAllPlayers() {
  return db.data.players || [];
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
export async function addScore(playerId) {
  if (playerId === "0") {
    const actualScores = db.data.game.assignedScores || [];
    if (actualScores.length < 2) {
      actualScores.push(playerId);
      db.data.game.assignedScores = actualScores;
      await db.write();
    }
    return;
  }

  const player = db.data.players.find((p) => p.id === playerId);
  if (!player) return;

  const actualScores = db.data.game.assignedScores || [];

  if (actualScores.length >= 2) return;

  if (actualScores.length === 0) {
    player.score += 1;
    actualScores.push(playerId);
  } else if (actualScores.length === 1) {
    player.score += 0.5;
    actualScores.push(playerId);
  }

  db.data.game.assignedScores = actualScores;
  await db.write();
}

export async function getPlayerScore(playerId) {
  const player = db.data.players.find((p) => p.id === playerId);
  return player ? player.score : 0;
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

export async function getAssignedScores() {
  return db.data.game.assignedScores || [];
}

////////////////////////////////////////////////////
//
// Sección de gestión de los turnos
//
///////////////////////////////////////////////////

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

////////////////////////////////////////////////////
//
// Sección de gestión de las presentaciones
//
///////////////////////////////////////////////////

export async function resetPresentation() {
  console.log("Reiniciando presentación en el servidor");
  if (!db.data.game.presentation) {
    db.data.game.presentation = {};
  }
  
  db.data.game.presentation.active = false;
  db.data.game.presentation.currentPresenter = null;
  db.data.game.presentation.stage = 0;
  
  await db.write();
  console.log("Presentación reiniciada: ", db.data.game.presentation);
  return db.data.game.presentation;
}

export async function getPresentation() {
  if (!db.data.game.presentation) {
    db.data.game.presentation = { active: false, currentPresenter: null, stage: 0 };
  } else if (db.data.game.presentation.stage === undefined) {
    db.data.game.presentation.stage = 0;
  }

  return db.data.game.presentation;
}

export async function nextPresenter() {
  if (!db.data.game.presentation) {
    db.data.game.presentation = {
      active: false,
      currentPresenter: null,
      stage: 0,
    };
  }

  db.data.game.presentation.stage = (db.data.game.presentation.stage + 1) % 5;

  if (db.data.game.presentation.stage === 0) {
    db.data.game.presentation.active = false;
    db.data.game.presentation.currentPresenter = null;
  } else {
    db.data.game.presentation.active = true;

    const playerIndex = db.data.game.presentation.stage - 1;
    if (playerIndex >= 0 && playerIndex < 4) {
      db.data.game.presentation.currentPresenter = db.data.players[playerIndex + 1]?.id || null;
    } else {
      db.data.game.presentation.currentPresenter = null;
    }
  }

  await db.write();
  return db.data.game.presentation;
}
