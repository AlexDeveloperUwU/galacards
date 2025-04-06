import path from "path";
import { fileURLToPath } from "url";
import { JSONFilePreset } from "lowdb/node";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, "..", "data", "db.json");
const defaultData = { players: [], game: {} };
let db;

// Inicializar la base de datos
export async function initializeDatabase() {
  db = await JSONFilePreset(dbFile, defaultData);
}

// Obtener la instancia de la base de datos
export function getDatabase() {
  return db;
}

// Guardar el nombre del jugador
export async function savePlayerName(playerId, name) {
  const player = db.data.players.find((p) => p.id === playerId);
  if (player) {
    player.name = name;
    await db.write();
  }
}

// Generar datos de jugadores
export async function generatePlayerData(gameBaseUrl, nanoid) {
  db.data.players = [];
  const hostId = nanoid(8);
  const host = {
    id: hostId,
    vdoUrl: `https://vdo.ninja/?push=${hostId}&webcam&bitrate=10000&aspectratio=0.75167&quality=1&stereo=1&autostart&device=1&room=glykroompush`,
    name: "Host",
  };
  db.data.players.push(host);

  for (let i = 1; i <= 4; i++) {
    const pId = nanoid(8);
    const player = {
      id: pId,
      playerUrl: `${gameBaseUrl}/player?id=${pId}`,
      vdoUrl: `https://vdo.ninja/?push=${pId}&webcam&bitrate=10000&aspectratio=0.75167&quality=1&stereo=1&autostart&device=1&room=glykroompush`,
      name: `Jugador ${i}`,
      score: 0,
    };
    db.data.players.push(player);
  }

  await db.write();
  console.log("Datos de jugadores generados.");
}

export async function generateImageArray() {
  const imageDir = path.join(__dirname, "..", "web", "public", "images");
  fs.readdir(imageDir, (err, files) => {
    if (err) {
      console.error("Error leyendo el directorio de imágenes:", err);
      return res.status(500).json({ error: "No se pudo leer las imágenes" });
    }

    const images = files.filter((file) => file !== "favicon.png" && file !== "LOGO.avif" && file !== "TC.avif");
    db.data.game.images = images;
    db.data.game.remainingImages = [...images];
  });
}

export async function deleteUsedImages(usedImages) {
  const db = getDatabase();
  db.data.game.remainingImages = db.data.game.remainingImages.filter((img) => !usedImages.includes(img));
  await db.write();
}
