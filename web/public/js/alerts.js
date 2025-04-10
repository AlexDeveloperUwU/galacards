////////////////////////////////////////////////////
//
// Alertas utilizadas en el controller
//
///////////////////////////////////////////////////

////////////////////////////////////////////////////
//
// Alertas utilizadas de forma general
//
///////////////////////////////////////////////////

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

function promptForUsername(socket) {
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
      socket.emit("player:setName", { name: result.value });
    }
  });
}
