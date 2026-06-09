const APP_ROUTE_SEGMENTS = new Set([
  "activity-center",
  "gold-coins-exchange",
  "topup-status",
]);

/**
 * Resolve vue-router history base when Vite uses relative base (`./`).
 * At bucket root (e.g. /activity-center) → returns "/".
 */
export function resolveHistoryBase() {
  const envBase = import.meta.env.BASE_URL;
  if (envBase && envBase !== "./") {
    return envBase;
  }

  const { pathname } = window.location;
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];

  if (last && APP_ROUTE_SEGMENTS.has(last)) {
    const prefix = segments.slice(0, -1);
    return prefix.length ? `/${prefix.join("/")}/` : "/";
  }

  if (pathname.endsWith("/index.html")) {
    const dir = pathname.slice(0, -"index.html".length);
    return dir || "/";
  }

  if (pathname.endsWith("/")) {
    return pathname;
  }

  const slash = pathname.lastIndexOf("/");
  return slash >= 0 ? pathname.slice(0, slash + 1) : "/";
}
