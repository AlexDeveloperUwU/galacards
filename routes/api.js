import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.get("/images", (req, res) => {
  const imageDir = path.join(__dirname, "..", "web", "public", "images");
  fs.readdir(imageDir, (err, files) => {
    if (err) {
      console.error("Error leyendo el directorio de imágenes:", err);
      return res.status(500).json({ error: "No se pudo leer las imágenes" });
    }

    const images = files.filter((file) => file !== "favicon.png" && file !== "LOGO.avif" && file !== "TC.avif");
    res.json(images);
  });
});

export default router;
