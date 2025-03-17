const reels = [
  document.getElementById("reel1"),
  document.getElementById("reel2"),
  document.getElementById("reel3"),
  document.getElementById("reel4"),
];
const names = [
  document.getElementById("name1"),
  document.getElementById("name2"),
  document.getElementById("name3"),
  document.getElementById("name4"),
];

let imageList = [];

async function fetchImages() {
  try {
    const response = await fetch("/images");
    imageList = await response.json();
    remainingImages = [...imageList];
    preloadImages(imageList);
    reels.forEach((reel, index) => {
      reel.innerHTML = `<div class="number">${index + 1}</div>`;
      names[index].textContent = `VTuber ${index + 1}`;
    });
  } catch (error) {
    console.error("Failed to fetch images:", error);
  }
}

window.onload = () => {
  fetchImages();
  fetch("/cleanChannels", {
    method: "DELETE",
  }).catch((error) => console.error("Error cleaning channels:", error));
};

let remainingImages = [...imageList];
let displayedImages = [];

function getRandomImage(imageArray) {
  const index = Math.floor(Math.random() * imageArray.length);
  return imageArray[index];
}

function createImageElement(imageName) {
  const img = document.createElement("img");
  img.src = `/public/images/${imageName}`;
  img.alt = imageName.split(".")[0];
  return img;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const audio = new Audio("/public/sounds/wheel.wav");
audio.loop = true;

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

function preloadImages(imageArray) {
  imageArray.forEach((imageName) => {
    const img = new Image();
    img.src = `/public/images/${imageName}`;
  });
}

async function spin() {
  const spinButton = document.getElementById("spinButton");
  spinButton.disabled = true;
  spinButton.classList.add("disabled");

  const reels = [
    document.getElementById("reel1"),
    document.getElementById("reel2"),
    document.getElementById("reel3"),
    document.getElementById("reel4"),
  ];

  const names = [
    document.getElementById("name1"),
    document.getElementById("name2"),
    document.getElementById("name3"),
    document.getElementById("name4"),
  ];

  const messageElement = document.getElementById("message");

  if (remainingImages.length < 4) {
    if (messageElement) messageElement.style.display = "block";
    spinButton.disabled = false;
    spinButton.classList.remove("disabled");
    return;
  }

  names.forEach((name) => {
    name.classList.remove("revealed");
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const selectedImages = [];
  const previousImages = [...displayedImages];

  for (let i = 0; i < 4; i++) {
    let randomImage;
    do {
      randomImage = getRandomImage(remainingImages);
    } while (selectedImages.includes(randomImage));
    selectedImages.push(randomImage);
    remainingImages = remainingImages.filter((img) => img !== randomImage);
  }

  console.log("Selected images:", selectedImages);
  console.log("Remaining images:", remainingImages);

  names.forEach((name, index) => {
    name.textContent = selectedImages[index].split(".")[0];
  });

  fetch("/djs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ selectedImages }),
  }).catch((error) => console.error("Error posting selected images:", error));

  const spinPromises = reels.map((reel, index) => {
    const initialImage = previousImages[index] || getRandomImage(imageList);
    return spinReel(reel, selectedImages[index], names[index], initialImage);
  });
  await Promise.all(spinPromises);

  displayedImages = selectedImages;

  if (remainingImages.length === 0) {
    spinButton.textContent = "Volver a empezar";
    spinButton.disabled = false;
    spinButton.classList.remove("disabled");
    spinButton.removeEventListener("click", spin);
    spinButton.addEventListener("click", resetGame);
  } else {
    spinButton.disabled = false;
    spinButton.classList.remove("disabled");
  }
}

function resetGame() {
  remainingImages = [...imageList];
  displayedImages = [];

  document.querySelectorAll(".reel").forEach((reel, index) => {
    reel.innerHTML = `<div class="number">${index + 1}</div>`;
  });

  document.querySelectorAll(".image-name").forEach((name, index) => {
    name.textContent = `VTuber ${index + 1}`;
    name.classList.remove("revealed");
  });

  const messageElement = document.getElementById("message");
  if (messageElement) messageElement.style.display = "none";

  const spinButton = document.getElementById("spinButton");
  spinButton.textContent = "¡Girar!";
  spinButton.disabled = false;
  spinButton.classList.remove("disabled");
  spinButton.removeEventListener("click", resetGame);
  spinButton.addEventListener("click", spin);

  fetch("/cleanChannels", {
    method: "DELETE",
  }).catch((error) => console.error("Error cleaning channels:", error));

  console.log("Game reset: Remaining images reset to full list.");
}

document.getElementById("spinButton").addEventListener("click", spin);
