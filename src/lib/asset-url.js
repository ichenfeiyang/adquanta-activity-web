/**
 * Resolve public asset paths for bucket-root static hosting.
 */
export function assetUrl(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  const base = import.meta?.env?.BASE_URL || "/";
  if (base === "./") {
    // Public files live at the bucket root. A route-relative URL such as
    // "./images/..." breaks on History routes like /feedback/success.
    return `/${clean}`;
  }
  return `${base.endsWith("/") ? base : `${base}/`}${clean}`;
}
