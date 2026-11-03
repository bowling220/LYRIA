// Keep chat controls inside the visible area when a phone keyboard opens.
(() => {
  const viewport = window.visualViewport;
  let frame;
  const updateViewport = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const height = viewport ? viewport.height : window.innerHeight;
      document.documentElement.style.setProperty(
        "--visible-height",
        height + "px",
      );
      document.body.classList.toggle(
        "keyboard-open",
        Boolean(viewport && height < window.innerHeight * 0.75),
      );
      document.documentElement.style.setProperty(
        "--visible-top",
        (viewport ? viewport.offsetTop : 0) + "px",
      );
    });
  };
  viewport?.addEventListener("resize", updateViewport);
  viewport?.addEventListener("scroll", updateViewport);
  window.addEventListener("resize", updateViewport);
  updateViewport();
})();
