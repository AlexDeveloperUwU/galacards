////////////////////////////////////////////////////
//
// Sección de configuración y constantes
//
///////////////////////////////////////////////////

const queryParams = new URLSearchParams(window.location.search);
const playerId = queryParams.get("id");
const isDevMode = queryParams.get("dev") === "true";
const audio = new Audio("/public/sounds/wheel.wav");
const turnAudio = new Audio("/public/sounds/turn.mp3");
let hostId = null;
let playerPosition = null;

const cardContainers = [
  document.getElementById("cardContainer1"),
  document.getElementById("cardContainer2"),
  document.getElementById("cardContainer3"),
  document.getElementById("cardContainer4"),
];

const cardNames = [
  document.getElementById("cardName1"),
  document.getElementById("cardName2"),
  document.getElementById("cardName3"),
  document.getElementById("cardName4"),
];
const pointsContainer = document.getElementById("pointsContainer");
const spinButton = document.getElementById("spinButton");
const turnButton = document.getElementById("turnButton");
const avaliableCards = document.getElementById("avaliableCards");
const currentRound = document.getElementById("roundNumber");
const totalRounds = document.getElementById("totalRounds");

////////////////////////////////////////////////////
//
// Sección de inicialización
//
///////////////////////////////////////////////////

window.onload = () => {
  document.getElementById("background-video").playbackRate = 0.5;
  audio.loop = true;
  /*
  document.addEventListener("copy", (e) => {
    e.preventDefault();
    console.warn("Copy functionality is disabled.");
  });

  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    console.warn("Right-click is disabled.");
  });

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" || // F12
      (e.ctrlKey && e.shiftKey && e.key === "I") || // Ctrl+Shift+I
      (e.ctrlKey && e.shiftKey && e.key === "J") || // Ctrl+Shift+J
      (e.ctrlKey && e.key === "U") || // Ctrl+U
      (e.ctrlKey && e.shiftKey && e.key === "C") // Ctrl+Shift+C
    ) {
      e.preventDefault();
      console.warn("Developer tools are disabled.");
    }
  });

  document.addEventListener("selectstart", (e) => {
    e.preventDefault();
    console.warn("Text selection is disabled.");
  });
  */
};

////////////////////////////////////////////////////
//
// Sección de socket.io
//
///////////////////////////////////////////////////

const socket = io(window.location.host, {
  auth: { id: playerId },
});

socket.on("connect", () => {
  if (isDevMode) {
    socket.emit("game:reset");
  }

  socket.emit("general:getData");
});

socket.on("general:returnData", (data) => {
  handleReturnedData(data, socket);
});

socket.on("game:returnGameData", (data) => {
  handleGameData(data);
});

socket.on("game:returnSpin", async (data) => {
  const { spinData, selected, hasMoreRounds, currentRound, remainingImages } = data;
  await handleSpinData(spinData, selected, hasMoreRounds, currentRound, remainingImages);
});

socket.on("game:returnScore", (data) => {
  handleReturnedScore(data);
});

socket.on("game:returnCurrentPlayer", (data) => {
  handleApplyCurrentRound(data);
});

socket.on("game:returnReset", async () => {
  handleGameReset();
});

socket.on("player:returnAllPlayersData", (data) => {
  const { players, updateVdo } = data;
  handlePlayerData(players, updateVdo, socket);
});

socket.on("player:returnPlayerNameChange", (data) => {
  const { players, updateVdo } = data;
  handlePlayerData(players, updateVdo, socket);
});

////////////////////////////////////////////////////
//
// Sección de funciones auxiliares para el socket
//
///////////////////////////////////////////////////

function handleReturnedData(data, socket) {
  const game = data.game || {};
  const players = data.players || [];

  if (players.length > 0) {
    handlePlayerData(players, true, socket);
  }

  if (game) {
    handleGameData(game);
  }

  const currentPlayerPosition = game.currentPlayer;
  if (currentPlayerPosition) {
    const cardContainer = document.getElementById(`cardContainer${currentPlayerPosition}`);
    const iframeContainer = document.getElementById(`player${currentPlayerPosition}iframe`);

    const currentHighlightedCard = document.querySelector(".shadow-glow .scale-\\[1\\.04\\]");
    if (currentHighlightedCard) {
      currentHighlightedCard.classList.remove("shadow-glow", "scale-[1.04]");
    }

    if (cardContainer) {
      cardContainer.classList.add("shadow-glow", "scale-[1.04]");
    }

    if (iframeContainer) {
      iframeContainer.classList.add("shadow-glow", "scale-[1.04]");
    }
  }
}

function handlePlayerData(players, updateVdo, socket) {
  // Handle host
  hostId = players[0].id;
  const hostIframe = document.getElementById("hostIframe");
  const hostName = document.getElementById("hostName");
  if (hostIframe && hostName) {
    if (updateVdo) {
      hostIframe.src = `https://vdo.ninja/?view=${hostId}&bitrate=10000&aspectratio=0.75167&autoplay=1&controls=0&muted=1&noaudio=1&cleanoutput`;
    }
    hostName.textContent = players[0]?.name || "Pulpo a la gallega";
  }
  pointsContainer.innerHTML = "";

  // Handle players
  players.slice(1).forEach((player, index) => {
    if (player.id === playerId) {
      playerPosition = index + 1;
    }
    const playerName = document.getElementById(`playerName${index + 1}`);
    const playerIframe = document.getElementById(`player${index + 1}iframe`);
    pointsContainer.innerHTML += `
    <div class="bg-purple-bg bg-opacity-50 rounded-lg p-2.5">
        <p class="text-white text-lg">
      ${player.name}: 
      <span id="score-${player.id}" class="font-bold text-purple-light score-update">${player.score}</span>
        </p>
    </div>`;

    const scoreElement = document.getElementById(`score-${player.id}`);
    if (scoreElement) {
      setTimeout(() => {
        scoreElement.classList.remove("score-update");
      }, 500);
    }

    if (playerName) {
      playerName.innerText = player.name;
    }
    if (playerIframe && updateVdo) {
      playerIframe.src = `https://vdo.ninja/?view=${player.id}&bitrate=10000&aspectratio=0.75167&autoplay=1&controls=0&muted=1&noaudio=1&cleanoutput`;
    }
  });

  players.forEach((player) => {
    if (player.id === playerId) {
      if (player.id === players[0].id && player.name.includes("Pulpo a la gallega")) {
        promptForUsername(socket);
      } else if (player.name.includes("Jugador")) {
        promptForUsername(socket);
      }
    }
  });
}

function handleGameData(game) {
  if (game.selectedImages) {
    const selectedImages = game.selectedImages;
    selectedImages.forEach((imageName, index) => {
      const cardContainer = cardContainers[index];
      const initialImage = document.getElementById(`cardGenerica${index + 1}`);

      initialImage.style.opacity = "0";
      initialImage.style.position = "absolute";

      const currentImage = createImageElement(imageName);
      currentImage.style.position = "absolute";
      currentImage.style.top = "0";
      currentImage.style.left = "0";
      currentImage.style.width = "100%";
      currentImage.style.height = "100%";
      cardContainer.appendChild(currentImage);

      const formattedName = imageName
        .split(".")[0]
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
      cardNames[index].textContent = formattedName;
    });
  }

  const currentPlayer = game.currentPlayer;
  if (currentPlayer) {
    applyStylesToCurrentPlayer(currentPlayer);
  } else {
    const currentHighlightedCard = document.querySelector(".shadow-glow .scale-\\[1\\.04\\]");
    if (currentHighlightedCard) {
      currentHighlightedCard.classList.remove("shadow-glow", "scale-[1.04]");
    }
  }
}

////////////////////////////////////////////////////
//
// Sección de funciones auxiliares para el juego
//
///////////////////////////////////////////////////

function createImageElement(imageName) {
  const img = document.createElement("img");
  img.src = `/public/images/${imageName}`;
  img.classList.add("w-full", "h-full", "object-cover", "rounded-2xl");
  img.alt = imageName.split(".")[0];
  return img;
}

async function fetchImages() {
  try {
    const response = await fetch("/images");
    const imageArray = await response.json();
    preloadImages(imageArray);
  } catch (error) {
    console.error("Failed to fetch images:", error);
  }
}

function preloadImages(imageArray) {
  imageArray.forEach((imageName) => {
    const img = new Image();
    img.src = `/public/images/${imageName}`;
  });
}

async function handleSpinData(spinData, selected) {
  const elementsWithEffects = document.querySelectorAll(".shadow-glow, .scale-\\[1\\.04\\]");
  elementsWithEffects.forEach((element) => {
    element.classList.remove("shadow-glow", "scale-[1.04]");
  });

  for (const name of cardNames) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.add("blurCardName");
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let i = 0; i < 4; i++) {
    const formattedName = selected[i]
      .split(".")[0]
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
    cardNames[i].textContent = formattedName;
  }

  audio.volume = 1.0;
  audio.play();

  const spinPromises = spinData.map((reelData, index) => {
    const cardContainer = cardContainers[index];
    return spinContainer(index, cardContainer, reelData);
  });
  await Promise.all(spinPromises);

  const fadeOutInterval = setInterval(() => {
    if (audio.volume > 0.1) {
      audio.volume -= 0.1;
    } else {
      audio.volume = 0.0;
      clearInterval(fadeOutInterval);
    }
  }, 100);
  setTimeout(() => {
    audio.pause();
    audio.currentTime = 0;
  }, 600);

  for (const [index, name] of cardNames.entries()) {
    if (index + 1 !== playerPosition) {
      name.classList.add("revealed");
      await new Promise((resolve) => setTimeout(resolve, 400));
      name.addEventListener(
        "transitionend",
        () => {
          name.classList.remove("blurCardName");
          name.classList.remove("revealed");
        },
        { once: true }
      );
    }
  }
}

async function spinContainer(cardContainerNumber, cardContainer, reelData) {
  return new Promise((resolve) => {
    const initialImage = document.getElementById(`cardGenerica${cardContainerNumber + 1}`);
    if (cardContainerNumber + 1 === playerPosition) {
      const winningCard = reelData[reelData.length - 1];
      reelData[reelData.length - 1] = "GENERAL.avif";
      reelData.push(winningCard);
    }

    const oldStrip = cardContainer.querySelector(".strip");
    if (oldStrip) {
      const lastImage = createImageElement(reelData[reelData.length - 1]);
      lastImage.style.position = "absolute";
      lastImage.style.top = "0";
      lastImage.style.left = "0";
      lastImage.style.width = "100%";
      lastImage.style.height = "100%";
      cardContainer.appendChild(lastImage);

      oldStrip.remove();
    }

    let currentPosition = 0;
    const totalImages = cardContainerNumber + 1 === playerPosition ? 17 : 16;
    const imageHeight = initialImage.clientHeight;
    const imageWidth = initialImage.clientWidth;
    const totalHeight = totalImages * imageHeight;
    const finalPosition =
      cardContainerNumber + 1 === playerPosition ? (totalImages - 2) * imageHeight : (totalImages - 1) * imageHeight;

    const strip = document.createElement("div");
    strip.style.width = `${imageWidth}px`;
    strip.style.height = `${totalHeight}px`;
    strip.className = "strip";
    reelData.forEach((img) => {
      const imgElement = createImageElement(img);
      strip.appendChild(imgElement);
    });

    const tempImage = cardContainer.querySelector("img:not(.strip img)");
    if (tempImage && tempImage.id !== `cardGenerica${cardContainerNumber + 1}`) {
      tempImage.remove();
    }

    cardContainer.appendChild(strip);
    initialImage.style.opacity = "0";
    initialImage.style.position = "absolute";

    function animateReel() {
      currentPosition += imageHeight / 5;
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
          resolve();
        }, 600);
      } else {
        requestAnimationFrame(animateReel);
      }
    }
    animateReel();
  });
}

async function handleGameReset() {
  cardNames.forEach((name) => {
    name.classList.remove("blurCardName");
    name.classList.remove("revealed");
  });

  for (const [index, name] of cardNames.entries()) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.add("blurCardName");
  }

  await Promise.all(
    cardContainers.map((container, index) => {
      return new Promise((resolve) => {
        const images = container.querySelectorAll("img:not(#cardGenerica" + (index + 1) + ")");
        const genericImage = document.getElementById(`cardGenerica${index + 1}`);

        genericImage.style.zIndex = "1";

        const reel = document.createElement("div");
        reel.style.position = "absolute";
        reel.style.top = "0";
        reel.style.left = "0";
        reel.style.width = "100%";
        reel.style.height = "100%";
        reel.style.zIndex = "2";
        reel.className = "reel-transition";
        container.appendChild(reel);

        void genericImage.offsetWidth;

        requestAnimationFrame(() => {
          images.forEach((img) => {
            img.style.transition = "opacity 0.6s ease-in-out";
            img.style.opacity = "0";
          });

          genericImage.style.transition = "opacity 0.6s ease-in-out";
          genericImage.style.opacity = "1";

          setTimeout(() => {
            images.forEach((img) => img.remove());

            reel.remove();
            genericImage.style.zIndex = "2";
            genericImage.style.opacity = "1";

            genericImage.style.transition = "none";

            setTimeout(() => {
              resolve();
            }, 600);
          }, 600);
        });
      });
    })
  );

  cardNames.forEach((name, index) => {
    name.textContent = ["¿Conseguirás", "adivinar", "quién", "eres?"][index];
  });

  const elementsWithEffects = document.querySelectorAll(".shadow-glow, .scale-\\[1\\.04\\]");
  elementsWithEffects.forEach((element) => {
    element.classList.remove("shadow-glow", "scale-[1.04]");
  });

  for (const name of cardNames) {
    name.classList.add("revealed");
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.remove("blurCardName", "revealed");
  }
}

function applyStylesToCurrentPlayer(playerId) {
  const currentHighlightedElements = document.querySelectorAll(".shadow-glow.scale-\\[1\\.04\\]");
  currentHighlightedElements.forEach((element) => {
    element.classList.remove("shadow-glow", "scale-[1.04]");
  });

  if (playerId) {
    turnAudio.volume = 1.0;
    turnAudio.play();
    const cardContainer = document.getElementById(`cardContainer${playerId}`);
    const iframeContainer = document.getElementById(`player${playerId}iframe`);

    if (cardContainer) {
      cardContainer.classList.add("shadow-glow", "scale-[1.04]");
    }

    if (iframeContainer) {
      iframeContainer.classList.add("shadow-glow", "scale-[1.04]");
    }
  }
}

function handleApplyCurrentRound(data) {
  applyStylesToCurrentPlayer(data.playerId);
}

function handleReturnedScore(data) {
  socket.emit("game:getAssignedScores");

  socket.once("game:returnAssignedScores", (assignedScores) => {
    const playerNameElement = cardNames[playerPosition - 1];
    const { playerId: playerAuth, score } = data;
    console.log(data)
    const scoreElement = document.getElementById(`score-${playerAuth}`);
    if (scoreElement || playerAuth === "0") {
      if (scoreElement) {
        scoreElement.textContent = score;
        scoreElement.classList.remove("score-update");
        void scoreElement.offsetWidth;
        scoreElement.classList.add("score-update");
        setTimeout(() => {
          scoreElement.classList.remove("score-update");
        }, 500);
      }

      if (
        (playerAuth === playerId || playerAuth === "0" || assignedScores.assignedScores.length === 2) &&
        playerNameElement.classList.contains("blurCardName")
      ) {
        if (playerNameElement) {
          playerNameElement.classList.add("revealed");
          setTimeout(() => {
            playerNameElement.classList.remove("blurCardName", "revealed");
          }, 400);

          const cardContainer = cardContainers[playerPosition - 1];
          const strip = cardContainer.querySelector(".strip");
          if (strip) {
            const imageHeight = strip.firstChild.clientHeight;
            const finalPosition = (strip.childElementCount - 1) * imageHeight;

            strip.style.transition = "transform 0.6s ease-out";
            strip.style.transform = `translateY(-${finalPosition}px)`;

            setTimeout(() => {
              strip.style.transition = "none";
              strip.style.transform = `translateY(-${finalPosition}px)`;
            }, 600);
          }
        }
      }
    } else {
      console.warn(`Score element for player ${playerId} not found.`);
    }
  });
}
