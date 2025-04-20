const queryParams = new URLSearchParams(window.location.search);
const playerId = queryParams.get("id");

window.onload = () => {
  document.getElementById("background-video").playbackRate = 0.5;

  const slideIds = ["slide-start", "slide-end"];
  let currentSlide = 0;

  const updateSlide = () => {
    slideIds.forEach((id, index) => {
      const slide = document.getElementById(id);
      slide.classList.toggle("hidden", index !== currentSlide);
    });

    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const vamosBtn = document.getElementById("vamos-btn");

    prevBtn.disabled = currentSlide === 0;

    if (currentSlide === slideIds.length - 1) {
      nextBtn.classList.add("hidden");
      vamosBtn.classList.remove("hidden");
    } else {
      nextBtn.classList.remove("hidden");
      vamosBtn.classList.add("hidden");
    }
  };

  document.getElementById("prev-btn").onclick = () => {
    if (currentSlide > 0) {
      currentSlide--;
      updateSlide();
    }
  };

  document.getElementById("next-btn").onclick = () => {
    if (currentSlide < slideIds.length - 1) {
      currentSlide++;
      updateSlide();
    }
  };

  document.getElementById("vamos-btn").onclick = () => {
    window.location.href = `/player?id=${playerId}`;
  };

  updateSlide();
};
