import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.get("/v1", (req, res) => {
  res.render("v1");
});

router.get("/", (req, res) => {
  res.render("index", { title: "Qué soy? | Inicio" });
});

router.get("/overlay", (req, res) => {
  res.render("overlay", { title: "Qué soy? | Overlay" });
});

router.get("/controller", (req, res) => {
  res.render("controller", { title: "Qué soy? | Control" });
});

router.get("/player", (req, res) => {
  res.render("player", { title: "Qué soy? | Jugador" });
});

router.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "public", "js", "sw.js"));
});

export default router;
