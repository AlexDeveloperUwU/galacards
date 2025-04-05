import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import fs from "fs";
import apiRoutes from "./routes/api.js";
import webRoutes from "./routes/web.js";
import initializeSocket from "./socket.js";
import { nanoid } from "nanoid";
import { initializeDatabase, generatePlayerData, getDatabase } from "./utils/db.js";
import { readFile } from "fs/promises";

const data = await readFile('./config/config.json', 'utf-8');
const config = JSON.parse(data);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const app = express();
const port = config.gamePort;

const server = http.createServer(app);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "web", "views"));

app.use(express.json());

//! Rutas
app.use("/api", apiRoutes);
app.use("/", webRoutes);
app.get("/error/:code", (req, res) => {
  const code = parseInt(req.params.code, 10) || 404;
  res.status(code).render("error", { title: `${config.gameName} | Error ${code}`, errorCode: code });
});

app.use("/public", express.static(path.join(__dirname, "web", "public")));

//! Inicialización del servidor

// Inicializar socket.io
initializeSocket(server);

// Inicializar base de datos
await initializeDatabase();

if (process.argv.includes("dataReset")) {
  await generatePlayerData(config.gameBaseUrl, nanoid);
}

// Obtener el ID del host desde la base de datos
const db = getDatabase();
const hostId = db.data.players[0]?.id;

server.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  if (hostId) {
    console.log(`Controller disponible en ${config.gameBaseUrl}/controller?id=${hostId}`);
  } else {
    console.log("No se pudo obtener el ID del host.");
  }
});
