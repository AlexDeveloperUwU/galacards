const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const sharp = require("sharp");
const imgbbUploader = require("imgbb-uploader");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log("Bot ready!");

  app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
});

client.login(process.env.DISCORD_TOKEN);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

app.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "public", "js", "sw.js"));
});

const tempDir = path.join(__dirname, "tmp");

if (fs.existsSync(tempDir)) {
  fs.readdirSync(tempDir).forEach((file) => {
    fs.unlinkSync(path.join(tempDir, file));
  });
} else {
  fs.mkdirSync(tempDir);
}

app.post("/djs", async (req, res) => {
  const { selectedImages } = req.body;
  console.log("Selected images:", selectedImages);

  if (!Array.isArray(selectedImages) || selectedImages.length !== 4) {
    return res.status(400).send("Invalid images array");
  }

  const imageDir = path.join(__dirname, "web", "public", "images");

  const images = [];
  const players = [];
  for (let i = 0; i < selectedImages.length; i++) {
    const imageName = selectedImages[i];
    const playerNumber = i + 1;
    const playerName = process.env[`PLAYER_${playerNumber}_NAME`];
    const playerId = process.env[`PLAYER_${playerNumber}`];
    players.push({ name: playerName, image: imageName, id: playerId });
    const imagePath = path.join(imageDir, imageName);
    images.push(imagePath);
  }

  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD);

  try {
    const messagePromises = [];
    const resizedImagesPromises = players.map(async (player) => {
      const otherImages = images.filter((_, index) => players[index] !== player);

      const resizedImages = await Promise.all(
        otherImages.map(async (image) => {
          try {
            const sanitizedImageName = path.basename(image, path.extname(image)).replace(/\s+/g, "_");
            const resizedImagePath = path.join(tempDir, `resized_${sanitizedImageName}.png`);
            await sharp(image).resize(750, 1000).png().toFile(resizedImagePath);
            return resizedImagePath;
          } catch (error) {
            console.error(`Error resizing image ${image}:`, error);
            return null;
          }
        })
      );

      const validResizedImages = resizedImages.filter((image) => image !== null);

      if (validResizedImages.length !== 3) {
        throw new Error("Failed to resize all images");
      }

      return { player, validResizedImages };
    });

    const resizedImagesResults = await Promise.all(resizedImagesPromises);

    for (const { player, validResizedImages } of resizedImagesResults) {
      const sanitizedPlayerName = player.name.replace(/\s+/g, "_");
      const combinedImagePath = path.join(tempDir, `combined_${sanitizedPlayerName}.png`);

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

      const response = await imgbbUploader(process.env.IMGBB_API_KEY, combinedImagePath);

      const imageUrl = response.url;

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
