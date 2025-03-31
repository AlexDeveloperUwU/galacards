import { nanoid } from "nanoid";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { JSONFilePreset } from "lowdb/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, "data", "db.json");
const defaultData = { players: [] };
let db;

async function initializeDatabase() {
  db = await JSONFilePreset(dbFile, defaultData);
}

async function registerSocketHandlers(socket) {
  console.log(`Nuevo cliente conectado! Socket ID: ${socket.id} Player ID: ${socket.handshake.query.id}`);

  //! Mensaje para obtener los datos de los jugadores
  socket.on("getPlayerData", () => {
    const players = db.data.players;
    socket.emit("playerData", players);
  });

  //! Mensaje para generar los datos de los jugadores
  socket.on("generatePlayerData", async () => {
    db.data.players = [];

    // Crear el host (player 0)
    const hostId = nanoid(8);
    const isLocalhost = socket.handshake.headers.host.includes("localhost");
    const protocol = isLocalhost ? "http" : "https";
    const host = {
      id: hostId,
      vdoUrl: `https://vdo.ninja/?push=${hostId}&webcam&bitrate=10000&aspectratio=0.75167&quality=1&stereo=1&autostart&device=1&room=glykroompush`,
      name: "Host",
    };
    db.data.players.push(host);

    // Crear los 4 jugadores (player 1 - player 4)
    for (let i = 1; i <= 4; i++) {
      const pId = nanoid(8);
      const player = {
        id: pId,
        playerUrl: `${protocol}://${socket.handshake.headers.host}/player?id=${pId}`,
        vdoUrl: `https://vdo.ninja/?push=${pId}&webcam&bitrate=10000&aspectratio=0.75167&quality=1&stereo=1&autostart&device=1&room=glykroompush`,
        name: `Jugador ${i}`,
        score: 0,
      };
      db.data.players.push(player);
    }

    await db.write();
    const players = db.data.players;
    socket.emit("generatedPlayerData", players);
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
}

async function initializeSocket(server) {
  await initializeDatabase();
  const io = new Server(server);

  io.on("connection", (socket) => {
    registerSocketHandlers(socket);
  });
}

export default initializeSocket;
