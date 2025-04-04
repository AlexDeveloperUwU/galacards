import express from "express";
import path from "path";
import dotenv from "dotenv";
import http from "http";
import { fileURLToPath } from "url";
import fs from "fs";
import apiRoutes from "./routes/api.js";
import webRoutes from "./routes/web.js";
import initializeSocket from "./socket.js";
import { nanoid } from "nanoid";
import { JSONFilePreset } from "lowdb/node";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "web", "views"));

app.use(express.json());

//! Rutas
app.use("/api", apiRoutes);
app.use("/", webRoutes);
app.get("/error/:code", (req, res) => {
  const code = parseInt(req.params.code, 10) || 404;
  res.status(code).render("error", { title: `Qué soy? | Error ${code}`, errorCode: code });
});

app.use("/public", express.static(path.join(__dirname, "web", "public")));

//! Inicializar socket.io
initializeSocket(server);

const gameBaseUrl = process.env.GAME_BASE_URL || "http://localhost:3000";

const dbFile = path.join(__dirname, "data", "db.json");
const defaultData = { players: [] };
const db = await JSONFilePreset(dbFile, defaultData);

// Función para generar datos de jugadores
async function generatePlayerData() {
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

if (process.argv.includes("dataReset")) {
  generatePlayerData();
}

server.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  console.log(`Controller disponible en ${gameBaseUrl}/controller?id=${db.data.players[0].id}`);
});
