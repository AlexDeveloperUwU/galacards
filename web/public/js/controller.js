// Configuración inicial
document.getElementById("background-video").playbackRate = 0.5;

const queryParams = new URLSearchParams(window.location.search);
const playerId = queryParams.get("id");

const socket = io(window.location.host, {
  auth: { id: playerId },
});

let hostId = null;

// Funciones auxiliares
function handlePlayerData(players) {
  console.log("Recibido playerData:", players);
  if (players.length > 0) {
    hostId = players[0]?.id;

    if (players[0]?.name === "Host") {
      promptForHostName();
    }

    updatePlayerFrames(players.slice(1));
  }
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
      socket.emit("savePlayerName", { playerId: hostId, name: result.value });
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

function handleSpinButton() {
  const button = document.getElementById("changingGameButton");

  if (button.textContent === "Reset") {
    socket.emit("resetImageLists");
    button.textContent = "¡Girar!";
    button.disabled = false;
    button.classList.remove("disabled");
  } else {
    socket.off("spinResult");

    socket.on("spinResult", (data) => {
      if (data.error) {
        console.error(data.error);
        return;
      }

      const { spinData, selectedImages, hasMoreRounds } = data;
      console.log("Spin data:", spinData);
      console.log("Selected images:", selectedImages);
      console.log("Has more rounds:", hasMoreRounds);

      spinData.forEach((reelData, index) => {
        console.log(`Jugador ${index + 1}:`, reelData);
      });

      if (!hasMoreRounds) {
        button.textContent = "Reset";
        button.disabled = false;
      }
    });

    socket.emit("spin");
  }
}

// Eventos del socket
socket.on("connect", () => {
  console.log("Conectado al servidor con ID:", playerId);
  socket.emit("getPlayerData");
});

socket.on("connect_error", (err) => {
  console.error("Error de conexión:", err.message);
});

socket.on("disconnect", () => {
  console.log("Desconectado del servidor");
});

socket.on("playerData", handlePlayerData);

socket.on("savePlayerName", async (data) => {
  const { playerId, name } = data;
  await savePlayerName(playerId, name);
  sendPlayerData(socket);
});

socket.on("playerLinks", displayPlayerLinks);

socket.on("resetComplete", () => {
  console.log("Juego reseteado. Listo para empezar de nuevo.");
});

// Eventos del DOM
document.getElementById("getPlayerLinks").addEventListener("click", () => {
  socket.emit("getPlayerLinks");
});

document.getElementById("changingGameButton").addEventListener("click", handleSpinButton);
