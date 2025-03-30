const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const http = require("http");
const { JSONFilePreset } = require("lowdb/node");

dotenv.config();

const dbFile = path.join(__dirname, "data", "db.json");
const defaultData = { players: [] };
let db;

async function initializeDatabase() {
  db = await JSONFilePreset(dbFile, defaultData);
}

const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "web", "views"));

app.use(express.json());

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("mensaje", (data) => {
    console.log("Mensaje recibido:", data);
    socket.emit("respuesta", { mensaje: "Mensaje recibido correctamente" });
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

//! Rutas para la aplicación web
app.get("/v1", (req, res) => {
  res.render("v1");
});

app.get("/", (req, res) => {
  res.render("index", { title: "Qué soy? | Inicio" });
});

app.get("/overlay", (req, res) => {
  res.render("overlay", {title: "Qué soy? | Overlay"});
});

app.get("/controller", (req, res) => {
  res.render("controller", { title: "Qué soy? | Control" });
});

app.get("/player", (req, res) => {
  res.render("player", { title: "Qué soy? | Jugador" });
});

app.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "public", "js", "sw.js"));
});

//! Rutas para la API
app.get("/images", (req, res) => {
  const imageDir = path.join(__dirname, "web", "public", "images");
  fs.readdir(imageDir, (err, files) => {
    if (err) {
      console.error("Error leyendo el directorio de imágenes:", err);
      return res.status(500).json({ error: "No se pudo leer las imágenes" });
    }

    const images = files.filter((file) => file !== "favicon.png" && file !== "LOGO.avif" && file !== "TC.avif");
    res.json(images);
  });
});

app.use("/public", express.static(path.join(__dirname, "web", "public")));

initializeDatabase().then(() => {
  server.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
});
