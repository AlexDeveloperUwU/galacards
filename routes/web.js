import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import { getDatabase } from "../utils/db.js";

const data = await readFile("./config/config.json", "utf-8");
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

router.get("/", (req, res) => {
  res.render("index", { title: `Inicio | ${config.gameName}`, gameTitle: config.gameName });
});

router.get("/overlay", (req, res) => {
  res.render("overlay", { title: `Overlay | ${config.gameName}`, gameTitle: config.gameName });
});

router.get("/controller", isHost, (req, res) => {
  res.render("controller", { title: `Control | ${config.gameName}`, gameTitle: config.gameName });
});

router.get("/player", isHostOrPlayer, (req, res) => {
  res.render("player", { title: `Juego | ${config.gameName}`, gameTitle: config.gameName });
});

router.get("/anticheat", (req, res) => {
  const filePath = path.join(__dirname, "..", "web", "public", "files", "QueSoyAntiCheat.crx");
  res.download(filePath, "QueSoyAntiCheat.crx", (err) => {
    if (err) {
      console.error("Error al descargar el archivo anticheat:", err);
      res.status(500).send("No se pudo descargar el archivo.");
    }
  });
});

router.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "public", "js", "sw.js"));
});

router.get("/images", (req, res) => {
  const imageDir = path.join(__dirname, "..", "web", "public", "images");
  fs.readdir(imageDir, (err, files) => {
    if (err) {
      console.error("Error leyendo el directorio de imágenes:", err);
      return res.status(500).json({ error: "No se pudo leer las imágenes" });
    }

    const images = files.filter(
      (file) => file !== "favicon.png" && file !== "LOGO.avif" && file !== "TC.avif" && file !== "GENERAL.avif"
    );
    res.json(images);
  });
});

export default router;
