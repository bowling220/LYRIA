/* Shared display-name matching; no network calls or database schema changes. */
(() => {
  const fold = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  window.LyriaSearch = {
    matches: (name, query) => fold(name).includes(fold(query).trim()),
  };
})();
