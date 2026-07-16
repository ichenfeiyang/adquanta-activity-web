const SPA_PAGE_NAMES = new Set([
  "activity-center",
  "gold-coins-exchange",
  "topup-status",
]);

export function normalizeGaPagePath(pathname = "/") {
  const path = String(pathname || "/");
  if (path.endsWith("/")) return `${path}activity-center`;

  const slashIndex = path.lastIndexOf("/");
  const prefix = slashIndex >= 0 ? path.slice(0, slashIndex + 1) : "";
  const fileName = path.slice(slashIndex + 1);
  if (fileName === "index.html") return `${prefix}activity-center`;
  if (!fileName.endsWith(".html")) return path;

  const pageName = fileName.slice(0, -".html".length);
  if (SPA_PAGE_NAMES.has(pageName)) return `${prefix}${pageName}`;

  return path;
}
