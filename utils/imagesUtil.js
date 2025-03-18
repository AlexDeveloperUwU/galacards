const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const cliProgress = require("cli-progress");
const { v4: uuidv4 } = require("uuid");

async function optimizeImages(imageCache) {
  const imageDir = path.join(__dirname, "..", "web", "public", "images");
  const files = fs.readdirSync(imageDir);
  const tempDir = path.join(__dirname, "..", "tmp");

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
    if (file === "favicon.png" || file === "LOGO.avif" || file === "TC.avif") {
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

async function combineImages(player, validResizedImages, playerImgsDir) {
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

  return combinedImagePath;
}

module.exports = { optimizeImages, combineImages };
