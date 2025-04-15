document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.querySelector('input[type="url"]');
  const actionButton = document.getElementById("action-button");

  chrome.runtime.sendMessage({ action: "getSavedUrl" }, ({ url }) => {
    urlInput.value = url || "";
    urlInput.disabled = !!url;
    updateButtonState(url ? "stop" : "start");
  });

  actionButton.addEventListener("click", () => {
    const action = actionButton.dataset.action;
    const url = urlInput.value;

    if (action === "start" && !url) {
      alert("Por favor, ingrese una URL válida.");
      return;
    }

    chrome.runtime.sendMessage({ action, url }, ({ status }) => {
      if (status === "connected") {
        urlInput.disabled = true;
        updateButtonState("stop");
      } else if (status === "disconnected") {
        urlInput.disabled = false;
        updateButtonState("start");
      }
    });
  });

  function updateButtonState(action) {
    actionButton.textContent = action === "start" ? "Iniciar" : "Detener";
    actionButton.dataset.action = action;
    actionButton.classList.remove("hidden");
  }
});
