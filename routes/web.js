import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { JSONFilePreset } from "lowdb/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const isHost = async (req, res, next) => {
  const dbFile = path.join(__dirname, "..", "data", "db.json");
  const db = await JSONFilePreset(dbFile, { players: [] });
  const players = db.data.players || [];
  const userId = req.query.id;

  if (players[0] && players[0].id === userId) {
    return next();
  }
  return res.status(403).send("Acceso denegado: Solo el host puede acceder.");
};

const isHostOrPlayer = async (req, res, next) => {
  const dbFile = path.join(__dirname, "..", "data", "db.json");
  const db = await JSONFilePreset(dbFile, { players: [] });
  const players = db.data.players || [];
  const userId = req.query.id;

  if (players.some((player) => player.id === userId)) {
    return next();
  }
  return res.status(403).send("Acceso denegado: Solo el host o un jugador válido pueden acceder.");
};

router.get("/v1", (req, res) => {
  res.render("v1");
});

router.get("/", (req, res) => {
  res.render("index", { title: "Qué soy? | Inicio" });
});

router.get("/overlay", (req, res) => {
  res.render("overlay", { title: "Qué soy? | Overlay" });
});

router.get("/controller", isHost, (req, res) => {
  res.render("controller", { title: "Qué soy? | Control" });
});

router.get("/player", isHostOrPlayer, (req, res) => {
  res.render("player", { title: "Qué soy? | Jugador" });
});

router.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "public", "js", "sw.js"));
});

export default router;
