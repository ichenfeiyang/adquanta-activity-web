/**
 * Resolve public asset paths for bucket-root static hosting.
 */
export function assetUrl(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  const base = import.meta?.env?.BASE_URL || "/";
  if (base === "./") {
    return `./${clean}`;
  }
  return `${base.endsWith("/") ? base : `${base}/`}${clean}`;
}
