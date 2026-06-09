/**
 * Resolve public asset paths for bucket-root static hosting.
 */
export function assetUrl(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  const base = import.meta.env.BASE_URL || "/";
  if (base === "./") {
    return `./${clean}`;
  }
  return `${base.endsWith("/") ? base : `${base}/`}${clean}`;
}

/**
 * Build an in-app navigation URL relative to the current deployment path.
 */
export function appUrl(routePath, search = "") {
  const clean = String(routePath || "").replace(/^\/+/, "");
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return new URL(`${clean}${query}`, window.location.href).href;
}
