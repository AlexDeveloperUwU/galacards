const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const http = require("http");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "web", "views"));

app.use(express.json());

server.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

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

app.get("/", (req, res) => {
  res.render("index");
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
