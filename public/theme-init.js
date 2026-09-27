
try {
  const theme = localStorage.getItem("earthsar-theme");
  document.documentElement.dataset.theme = theme === "dark" || theme === "light" ? theme : "light";
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
