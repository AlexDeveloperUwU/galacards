const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createReverseTunnel } = require("./utils/sshUtil.js");
const { optimizeImages, combineImages } = require("./utils/imagesUtil.js");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const imageCache = new Map();

let sshProcess;

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
    process.env.WEB_URL = tunnelUrl;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  await optimizeImages(imageCache);

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
        const combinedImagePath = await combineImages(player, validResizedImages, playerImgsDir);

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

        const buttons = otherPlayers.map((otherPlayer) => {
          const searchUrl = `https://unduck.link?q=${encodeURIComponent(otherPlayer.name + " vtuber !g")}`;
          return new ButtonBuilder().setLabel(otherPlayer.name).setStyle(ButtonStyle.Link).setURL(searchUrl);
        });

        const row = new ActionRowBuilder().addComponents(buttons);

        const channel = guild.channels.cache.get(player.id);
        if (channel) {
          messagePromises.push(channel.send({ embeds: [embed], components: [row] }));
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

  app.delete("/cleanChannels", async (req, res) => {
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD);
    const playerChannels = [process.env.PLAYER_1, process.env.PLAYER_2, process.env.PLAYER_3, process.env.PLAYER_4];

    const cleanPromises = playerChannels.map((channelId) => {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        // This value is 100 because it's the maximum amount and the bot never sends more messages than that in a round
        return channel.bulkDelete(100);
      }
    });

    try {
      await Promise.all(cleanPromises);
      res.status(200).send("Channels cleaned");
    } catch (error) {
      console.error("Error cleaning channels:", error);
      res.status(500).send("Error cleaning channels");
    }
  });

  app.use("/public", express.static(path.join(__dirname, "web", "public")));
  app.use("/embedImgs", express.static(playerImgsDir));
}

process.on("SIGINT", () => {
  if (sshProcess) {
    sshProcess.kill();
  }
  client.destroy(); // Cierra la conexión del cliente de Discord
  process.exit();
});

main();
