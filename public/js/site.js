(() => {
  const toast = (message, title) => {
    if (window.ot?.toast) {
      window.ot.toast(message, title, { variant: "success" });
    }
  };

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.getAttribute("data-copy");
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        toast("Copied to clipboard", "Copied");
      } catch {
        window.prompt("Copy this link:", value);
      }
    });
  });

  document.querySelectorAll("form[data-delete]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!window.confirm("Delete this short link?")) {
        event.preventDefault();
      }
    });
  });
})();
