import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";

const data = await readFile('./config/config.json', 'utf-8');
const config = JSON.parse(data);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const isHost = (req, res, next) => {
  const db = getDatabase();
  const players = db.data.players || [];
  const userId = req.query.id;

  if (players[0] && players[0].id === userId) {
    return next();
  }
  return res.redirect("/error/403");
};

const isHostOrPlayer = (req, res, next) => {
  const db = getDatabase();
  const players = db.data.players || [];
  const userId = req.query.id;

  if (players.some((player) => player.id === userId)) {
    return next();
  }
  return res.redirect("/error/403");
};

router.get("/v1", (req, res) => {
  res.render("v1", { title: `${config.gameName} | Versión 1` });
});

router.get("/", (req, res) => {
  res.render("index", { title: `Inicio | ${config.gameName}` });
});

router.get("/overlay", (req, res) => {
  res.render("overlay", { title: `Overlay | ${config.gameName}` });
});

router.get("/controller", isHost, (req, res) => {
  res.render("controller", { title: `Control | ${config.gameName}` });
});

router.get("/player", isHostOrPlayer, (req, res) => {
  res.render("player", { title: `Juego | ${config.gameName}` });
});

router.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "public", "js", "sw.js"));
});

export default router;
