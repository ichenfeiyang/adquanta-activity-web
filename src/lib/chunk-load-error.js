/**
 * Show a user-visible error when a lazy-loaded page chunk fails to download.
 */
export function showChunkLoadError(pageLabel = "Page") {
  const message = `${pageLabel} failed to load. Please check your network and refresh.`;
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.className = "toast toast-warning";
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 4000);
    return;
  }
  window.alert(message);
}
