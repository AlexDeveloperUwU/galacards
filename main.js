const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const sharp = require("sharp");
const cliProgress = require("cli-progress");
const { v4: uuidv4 } = require("uuid");
const { exec, spawn } = require("child_process");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const webUrl = process.env.WEB_URL;

app.use(express.json());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const imageCache = new Map();

let sshProcess; // Añadir una variable global para el proceso SSH

async function optimizeImages() {
  const imageDir = path.join(__dirname, "web", "public", "images");
  const files = fs.readdirSync(imageDir);
  const tempDir = path.join(__dirname, "tmp");

  const optimizedImages = [];
  const progressBar = new cliProgress.SingleBar(
    {
      format: "Progress [{bar}] {percentage}% | {value}/{total} files | ETA: {eta}s",
    },
    cliProgress.Presets.shades_classic
  );

  console.log("Iniciando optimización de imágenes...");
  progressBar.start(files.length, 0);

  const optimizationPromises = files.map(async (file, index) => {
    if (file === "favicon.png" || file === "LOGO.avif") {
      progressBar.increment();
      return;
    }

    const sanitizedImageName = path.basename(file, path.extname(file)).replace(/\s+/g, "_") + ".png";
    const imagePath = path.join(imageDir, file);
    const optimizedImagePath = path.join(tempDir, sanitizedImageName);

    try {
      await sharp(imagePath).resize(750, 1000).png({ quality: 80 }).toFile(optimizedImagePath);
      optimizedImages.push({ original: imagePath, optimized: optimizedImagePath });
      imageCache.set(path.basename(imagePath), optimizedImagePath);
    } catch (error) {
      console.error(`Error optimizing image ${file}:`, error);
    } finally {
      progressBar.increment();
    }
  });

  await Promise.all(optimizationPromises);
  progressBar.stop();
  return optimizedImages;
}

async function createReverseTunnel() {
  return new Promise((resolve, reject) => {
    sshProcess = spawn("ssh", ["-o", "StrictHostKeyChecking=no", "-R", "80:localhost:3000", "serveo.net"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    sshProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(output);
      const match = output.match(/https:\/\/[a-z0-9]+\.serveo\.net/);
      if (match) {
        resolve(match[0]);
      }
    });

    sshProcess.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    sshProcess.on("error", (error) => {
      reject(`Error creating reverse tunnel: ${error.message}`);
    });

    sshProcess.on("close", (code) => {
      if (code !== 0) {
        reject(`SSH process exited with code ${code}`);
      }
    });
  });
}

async function main() {
  const tempDir = path.join(__dirname, "tmp");
  const playerImgsDir = path.join(tempDir, "playerImgs");

  if (fs.existsSync(tempDir)) {
    fs.readdirSync(tempDir).forEach((file) => {
      const filePath = path.join(tempDir, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
  } else {
    fs.mkdirSync(tempDir);
  }

  if (!fs.existsSync(playerImgsDir)) {
    fs.mkdirSync(playerImgsDir);
  } else {
    fs.readdirSync(playerImgsDir).forEach((file) => {
      const filePath = path.join(playerImgsDir, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
  }

  try {
    const tunnelUrl = await createReverseTunnel();
    console.log(`Tunnel URL: ${tunnelUrl}`);
    process.env.WEB_URL = tunnelUrl;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  await optimizeImages();

  client.once("ready", () => {
    console.log("Bot ready!");

    app.listen(port, () => {
      console.log(`Servidor escuchando en http://localhost:${port}`);
    });
  });

  client.login(process.env.DISCORD_TOKEN);

  app.post("/djs", async (req, res) => {
    const { selectedImages } = req.body;

    if (!Array.isArray(selectedImages) || selectedImages.length !== 4) {
      return res.status(400).send("Invalid images array");
    }

    const images = [];
    const players = [];
    for (let i = 0; i < selectedImages.length; i++) {
      const imageName = selectedImages[i];
      const playerNumber = i + 1;
      const playerName = process.env[`PLAYER_${playerNumber}_NAME`];
      const playerId = process.env[`PLAYER_${playerNumber}`];
      players.push({ name: playerName, image: imageName, id: playerId });

      const optimizedImagePath = imageCache.get(imageName);
      if (optimizedImagePath) {
        images.push(optimizedImagePath);
      } else {
        return res.status(400).send(`Optimized image not found for ${imageName}`);
      }
    }

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD);

    try {
      const messagePromises = [];
      const resizedImagesPromises = players.map(async (player) => {
        const otherImages = images.filter((_, index) => players[index] !== player);

        const validResizedImages = otherImages.filter((image) => image !== null);

        if (validResizedImages.length !== 3) {
          throw new Error("Failed to resize all images");
        }

        return { player, validResizedImages };
      });

      const resizedImagesResults = await Promise.all(resizedImagesPromises);

      for (const { player, validResizedImages } of resizedImagesResults) {
        const sanitizedPlayerName = player.name.replace(/\s+/g, "_");
        const combinedImagePath = path.join(playerImgsDir, `combined_${sanitizedPlayerName}_${uuidv4()}.png`);

        await sharp({
          create: {
            width: 2250,
            height: 1000,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          },
        })
          .composite(validResizedImages.map((image, index) => ({ input: image, left: index * 750, top: 0 })))
          .png({ quality: 80 })
          .toFile(combinedImagePath);

        const imageUrl = `${process.env.WEB_URL}/embedImgs/${path.basename(combinedImagePath)}`;

        const otherPlayers = players.filter((p) => p !== player);
        const embedDescription = otherPlayers
          .map((otherPlayer) => `**${otherPlayer.name}** debe adivinar a **${path.parse(otherPlayer.image).name}**`)
          .join("\n\n");

        const embed = new EmbedBuilder()
          .setTitle("🎉 ¡Una nueva ronda ha comenzado! 🎉")
          .setDescription(embedDescription)
          .setColor(0x800080)
          .setImage(imageUrl);

        const channel = guild.channels.cache.get(player.id);
        if (channel) {
          messagePromises.push(channel.send({ embeds: [embed] }));
        }
      }

      await Promise.all(messagePromises);

      res.status(200).send("Images processed and messages sent");
    } catch (error) {
      console.error("Error processing images:", error);
      res.status(500).send("Error processing images");
    }
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

      const images = files.filter((file) => file !== "favicon.png" && file !== "LOGO.avif");
      res.json(images);
    });
  });

  app.use("/public", express.static(path.join(__dirname, "web", "public")));
  app.use("/embedImgs", express.static(playerImgsDir));
}

process.on("SIGINT", () => {
  if (sshProcess) {
    sshProcess.kill();
  }
  process.exit();
});

main();
