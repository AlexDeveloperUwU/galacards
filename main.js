const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

async function main() {
  app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "web", "index.html"));
  });

  app.get("/sw.js", (req, res) => {
    res.sendFile(path.join(__dirname, "web", "public", "js", "sw.js"));
  });

  app.get("/images", (req, res) => {
    const imageDir = path.join(__dirname, "web", "public", "images");
    fs.readdir(imageDir, (err, files) => {
      if (err) {
        console.error("Error reading image directory:", err);
        return res.status(500).json({ error: "Failed to read images" });
      }

      const images = files.filter((file) => file !== "favicon.png" && file !== "LOGO.avif" && file !== "TC.avif");
      res.json(images);
    });
  });

  app.use("/public", express.static(path.join(__dirname, "web", "public")));
}

main();
