import express from "express";
import path from "path";
import dotenv from "dotenv";
import http from "http";
import { fileURLToPath } from "url";
import apiRoutes from "./routes/api.js";
import webRoutes from "./routes/web.js";
import initializeSocket from "./socket.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "web", "views"));

app.use(express.json());

//! Rutas
app.use("/api", apiRoutes);
app.use("/", webRoutes);

app.use("/public", express.static(path.join(__dirname, "web", "public")));

//! Inicializar socket.io
initializeSocket(server);

server.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
