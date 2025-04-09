////////////////////////////////////////////////////
//
// Sección de configuración y constantes
//
///////////////////////////////////////////////////

const queryParams = new URLSearchParams(window.location.search);
const playerId = queryParams.get("id");
const isDevMode = queryParams.get("dev") === "true";
const audio = new Audio("/public/sounds/wheel.wav");

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

document.getElementById("changingGameButton").addEventListener("click", handleSpinButton);
document.getElementById("getPlayerLinks").addEventListener("click", () => {
  socket.emit("player:getLinks");
});

let hostId = null;

////////////////////////////////////////////////////
//
// Sección de inicialización
//
///////////////////////////////////////////////////

window.onload = () => {
  fetchImages();
  document.getElementById("background-video").playbackRate = 0.5;
  audio.loop = true;
  socket.emit("game:getState");
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
  socket.emit("player:getData");
  if (isDevMode) {
    socket.emit("game:reset");
  }
});

socket.on("connect_error", (err) => {
  console.error("Error de conexión:", err.message);
});

socket.on("disconnect", () => {
  console.log("Desconectado del servidor");
});

socket.on("player:data", handlePlayerData);

socket.on("player:nameUpdated", async (data) => {
  const { playerId, name } = data;
  await savePlayerName(playerId, name);
  sendPlayerData(socket);
});

socket.on("player:links", displayPlayerLinks);

socket.on("game:resetComplete", () => {
  console.log("Juego reseteado. Listo para empezar de nuevo.");
  handleResetGame();
});

socket.on("game:state", (gameState) => {
  handleGameState(gameState);
});

socket.on("game:round", (data) => {
  const { currentRound, remainingCards, totalRounds } = data;
  document.getElementById("avaliableCards").textContent = remainingCards;
  document.getElementById("roundNumber").textContent = `${currentRound}/${totalRounds}`;
});

socket.on("score:updateAll", updateScoreboard);
socket.on("score:update", (data) => {
  const { playerId, score } = data;
  updatePlayerScore(playerId, score);
});

////////////////////////////////////////////////////
//
// Funciones para el manejo del spin
//
///////////////////////////////////////////////////

function handleSpinButton() {
  const button = document.getElementById("changingGameButton");

  if (button.textContent === "Reset") {
    socket.emit("game:reset");
    button.textContent = "¡Girar!";
  } else {
    socket.emit("game:spin");

    // Lo desactivamos para que no se repita el evento
    socket.off("game:spinResult");

    socket.on("game:spinResult", async (data) => {
      if (data.error) {
        console.error(data.error);
        return;
      }

      const { spinData, selectedImages, hasMoreRounds } = data;

      await spin(spinData, selectedImages);

      if (!hasMoreRounds) {
        button.textContent = "Reset";
      }
    });
  }
}

async function spin(spinData, selectedImages) {
  const button = document.getElementById("changingGameButton");
  button.setAttribute("disabled", "true");

  for (const name of cardNames) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.add("blurCardName");
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  for (let i = 0; i < 4; i++) {
    const formattedName = selectedImages[i]
      .split(".")[0]
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
    cardNames[i].textContent = formattedName;
  }

  const spinPromises = spinData.map((reelData, index) => {
    const cardContainer = cardContainers[index];
    return spinContainer(index, cardContainer, reelData);
  });
  await Promise.all(spinPromises);

  for (const name of cardNames) {
    name.classList.add("revealed");
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.remove("blurCardName");
    name.classList.remove("revealed");
  }

  button.removeAttribute("disabled");
}

async function spinContainer(cardContainerNumber, cardContainer, reelData) {
  return new Promise((resolve) => {
    const initialImage = document.getElementById(`cardGenerica${cardContainerNumber + 1}`);

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
    const totalImages = 16;
    const imageHeight = initialImage.clientHeight;
    const imageWidth = initialImage.clientWidth;
    const totalHeight = totalImages * imageHeight;
    const finalPosition = (totalImages - 1) * imageHeight;

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

    audio.volume = 1.0;
    audio.play();

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
          resolve();
        }, 600);
      } else {
        requestAnimationFrame(animateReel);
      }
    }
    animateReel();
  });
}

////////////////////////////////////////////////////
//
// Funciones para el manejo de imágenes
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

////////////////////////////////////////////////////
//
// Funciones para el manejo del estado del juego
//
///////////////////////////////////////////////////

function handleGameState(gameState) {
  const { lastSelectedImages } = gameState;
  if (lastSelectedImages && lastSelectedImages.length === 4) {
    lastSelectedImages.forEach((imageName, index) => {
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
}

async function handleResetGame() {
  const button = document.getElementById("changingGameButton");
  button.setAttribute("disabled", "true");

  for (const name of cardNames) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.add("blurCardName");
  }

  await Promise.all(
    cardContainers.map((container, index) => {
      return new Promise((resolve) => {
        const images = container.querySelectorAll("img:not(#cardGenerica" + (index + 1) + ")");
        const genericImage = document.getElementById(`cardGenerica${index + 1}`);

        genericImage.style.position = "relative";
        genericImage.style.opacity = "1";
        genericImage.classList.add("crossfade-enter");

        images.forEach((img) => {
          img.classList.add("crossfade-exit", "crossfade-exit-active");
        });

        setTimeout(() => {
          images.forEach((img) => img.remove());
          genericImage.classList.add("crossfade-enter-active");

          setTimeout(() => {
            genericImage.classList.remove("crossfade-enter", "crossfade-enter-active");
            resolve();
          }, 600);
        }, 600);
      });
    })
  );

  cardNames.forEach((name, index) => {
    name.textContent = ["¿Conseguirás", "adivinar", "quién", "eres?"][index];
  });

  for (const name of cardNames) {
    name.classList.add("revealed");
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.remove("blurCardName", "revealed");
  }

  button.removeAttribute("disabled");
}

////////////////////////////////////////////////////
//
// Funciones para el manejo del scoreboard
//
///////////////////////////////////////////////////

function updateScoreboard(scores) {
  console.log("Recibido scoreboard:", scores);
  const pointsContainer = document.getElementById("pointsContainer");
  const scoreHtml = scores
    .filter((player) => player.id !== hostId)
    .map(
      (player) => `
        <div class="bg-purple-bg bg-opacity-50 rounded-lg p-2">
          <p class="text-white text-sm">
            ${player.name}: 
            <span id="score-${player.id}" class="font-bold text-purple-light score-update">${player.score}</span>
          </p>
        </div>
      `
    )
    .join("");

  pointsContainer.innerHTML = scoreHtml;

  scores.forEach((player) => {
    const scoreElement = document.getElementById(`score-${player.id}`);
    if (scoreElement) {
      setTimeout(() => {
        scoreElement.classList.remove("score-update");
      }, 500);
    }
  });
}

function updatePlayerScore(playerId, score) {
  const scoreElement = document.getElementById(`score-${playerId}`);
  if (scoreElement) {
    scoreElement.textContent = score;

    scoreElement.classList.add("score-update");
    setTimeout(() => {
      scoreElement.classList.remove("score-update");
    }, 500);
  }
}

////////////////////////////////////////////////////
//
// Funciones para el manejo de los jugadores
//
///////////////////////////////////////////////////

function handlePlayerData(players) {
  console.log("Recibido playerData:", players);
  if (players.length > 0) {
    hostId = players[0]?.id;

    const hostIframe = document.getElementById("hostIframe");
    const hostName = document.getElementById("hostName");
    if (hostIframe && hostName) {
      hostIframe.src = `https://vdo.ninja/?view=${hostId}&bitrate=10000&aspectratio=0.75167&autoplay=1&controls=0&muted=1&noaudio=1`;
      hostName.textContent = players[0]?.name || "Pulpo a la gallega";
    }

    if (players[0]?.name === "Host") {
      promptForHostName();
    }

    updatePlayerFrames(players.slice(1));
  }

  socket.emit("score:getAll");
}

function promptForHostName() {
  Swal.fire({
    title: "Escribe tu nombre :D",
    input: "text",
    inputAttributes: {
      maxlength: 20,
      autocapitalize: "off",
      autocorrect: "off",
      style:
        "text-align: center; font-size: 1rem; padding: 0.5rem; border-radius: 0.5rem; border: 2px solid #8b458b; background-color: #6a2c70; color: white; box-shadow: 0 0 10px #8b458b;",
    },
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: false,
    confirmButtonText: "Yep, esa persona soy yo!",
    customClass: {
      popup: "bg-[#8b458b] rounded-2xl p-6 shadow-2xl w-[90%] max-w-md",
      title: "text-3xl text-white font-bold mb-4 text-center",
      input: "text-purple-dark text-lg font-bold p-2 rounded-lg border-2 border-purple-light",
      confirmButton:
        "mt-4 w-full py-2 bg-purple-light text-purple-dark text-base font-bold rounded-lg hover:bg-purple-hover transition-colors duration-300 shadow-md",
    },
    preConfirm: (name) => {
      if (!name || name.trim().length === 0) {
        Swal.showValidationMessage("El nombre no puede estar vacío");
        return false;
      }
      if (name.length > 20) {
        Swal.showValidationMessage("El nombre no puede tener más de 20 caracteres");
        return false;
      }
      return name.trim();
    },
  }).then((result) => {
    if (result.isConfirmed) {
      socket.emit("player:updateName", { playerId: hostId, name: result.value });
    }
  });
}

function updatePlayerFrames(players) {
  players.forEach((player, index) => {
    const playerName = document.getElementById(`playerName${index + 1}`);
    const playerIframe = document.getElementById(`player${index + 1}iframe`);

    if (playerName && playerIframe) {
      playerName.innerText = player.name;
      playerIframe.src = `https://vdo.ninja/?view=${player.id}&bitrate=10000&aspectratio=0.75167&autoplay=1&controls=0&muted=1&noaudio=1`;
    }
  });
}

function displayPlayerLinks(players) {
  const contentHtml = players
    .map((player) => {
      const isHost = player.name === players[0]?.name;
      return `
        <div class="bg-purple-bg bg-opacity-94 rounded-lg p-3">
          <p class="text-white">Nombre: <span class="font-bold text-purple-light">${player.name}</span></p>
          <button class="mt-2 w-full py-2 bg-purple-light text-purple-dark text-sm font-bold rounded-lg transition-colors duration-300 shadow-md copy-link" 
            ${
              isHost
                ? `data-vdo-url="${player.vdoUrl}"`
                : `data-game-url="${player.playerUrl}" data-vdo-url="${player.vdoUrl}"`
            }>
            ${isHost ? "Copiar enlace" : "Copiar mensaje"}
          </button>
        </div>
      `;
    })
    .join("");

  Swal.fire({
    title: "Info jugadores",
    html: contentHtml,
    customClass: {
      popup: "bg-[#8b458b] rounded-2xl p-6 shadow-2xl w-[30%]",
      title: "text-3xl text-white font-bold mb-4 text-center",
      htmlContainer: "space-y-4",
      confirmButton:
        "mt-4 w-[100%] mx-auto py-2 bg-purple-light text-purple-dark text-base font-bold rounded-lg transition-colors duration-300 shadow-md",
    },
    showConfirmButton: true,
    confirmButtonText: "Cerrar",
    didOpen: () => {
      document.querySelectorAll(".copy-link").forEach((button) => {
        button.addEventListener("click", () => {
          const vdoUrl = button.getAttribute("data-vdo-url");
          const gameUrl = button.getAttribute("data-game-url");
          const isHost = !gameUrl;
          const message = isHost
            ? vdoUrl
            : `Hola! Te envío los enlaces que debes usar para jugar al juego ^^\n\nVDO.Ninja: ${vdoUrl}\nWeb Juego: ${gameUrl}\n\nEste mensaje es automatizado btw :p`;

          navigator.clipboard.writeText(message).then(() => {
            button.classList.add("bg-green-500", "text-white");
            setTimeout(() => button.classList.remove("bg-green-500", "text-white"), 1000);
          });
        });
      });
    },
  });
}
