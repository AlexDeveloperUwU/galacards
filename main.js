import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

app.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "public", "js", "sw.js"));
});

app.post("/djs", (req, res) => {
  res.json({ message: "Hola desde la API!" });
});

app.get("/images", (req, res) => {
  const imageDir = path.join(__dirname, "web", "public", "images");
  fs.readdir(imageDir, (err, files) => {
    if (err) {
      console.error("Error reading image directory:", err);
      return res.status(500).json({ error: "Failed to read images" });
    }

    const images = files.filter(
      (file) => file !== "favicon.png" && file !== "LOGO.avif"
    );
    res.json(images);
  });
});

app.use("/public", express.static(path.join(__dirname, "web", "public")));

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
