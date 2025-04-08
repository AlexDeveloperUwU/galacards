function spinReel(reelElement, finalImage, nameElement, initialImage) {
  return new Promise((resolve) => {
    const shuffledImages = shuffleArray([...imageList]);
    const reelImages = [initialImage, ...shuffledImages.slice(0, 14), finalImage];

    reelElement.innerHTML = "";
    const strip = document.createElement("div");
    strip.className = "strip";
    reelImages.forEach((img) => strip.appendChild(createImageElement(img)));
    reelElement.appendChild(strip);

    let currentPosition = 0;
    const totalImages = reelImages.length;
    const imageHeight = 350;
    const totalHeight = totalImages * imageHeight;
    const finalPosition = (totalImages - 1) * imageHeight;

    audio.volume = 1.0;
    audio.play();

    function animateReel() {
      currentPosition += imageHeight / 6;
      if (currentPosition >= totalHeight) {
        currentPosition = 0;
      }

      strip.style.transform = `translateY(-${currentPosition}px)`;

      if (currentPosition >= finalPosition - imageHeight && currentPosition <= finalPosition) {
        strip.style.transition = "transform 0.6s ease-out";
        strip.style.transform = `translateY(-${finalPosition}px)`;
        setTimeout(() => {
          strip.style.transition = "none";
          strip.style.transform = `translateY(-${finalPosition}px)`;
          nameElement.textContent = finalImage.split(".")[0];
          nameElement.classList.add("revealed");
          audio.volume = 0.1;
          setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
          }, 600);
          resolve();
        }, 600);
      } else {
        requestAnimationFrame(animateReel);
      }
    }

    animateReel();
  });
}

async function spin() {
  const spinPromises = reels.map((reel, index) => {
    const initialImage = previousImages[index] || getRandomImage(imageList);
    return spinReel(reel, selectedImages[index], names[index], initialImage);
  });
  await Promise.all(spinPromises);
}
