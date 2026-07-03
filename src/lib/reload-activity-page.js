import { ROUTE_NAMES } from "./activity-pages.js";

const APP_ROUTE_SEGMENTS = new Set(Object.values(ROUTE_NAMES));
const POST_RELOAD_PATH_KEY = "activity_post_reload_path_v1";

function resolveCurrentAppRoute() {
  const { pathname } = window.location;
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];

  if (last && APP_ROUTE_SEGMENTS.has(last)) {
    return `/${last}`;
  }

  return "/activity-center";
}

/**
 * Bucket/CDN entry file path for the current location.
 * e.g. /activity-center -> /index.html, /foo/index.html -> /foo/index.html
 */
export function resolveIndexHtmlPathname(pathname = window.location.pathname) {
  if (pathname.endsWith("/index.html")) {
    return pathname;
  }

  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];

  if (last && APP_ROUTE_SEGMENTS.has(last)) {
    const prefix = segments.slice(0, -1);
    return prefix.length ? `/${prefix.join("/")}/index.html` : "/index.html";
  }

  if (pathname.endsWith("/")) {
    return `${pathname}index.html`;
  }

  const slash = pathname.lastIndexOf("/");
  if (slash >= 0) {
    return `${pathname.slice(0, slash + 1)}index.html`;
  }

  return "/index.html";
}

function isIndexHtmlEntry(pathname = window.location.pathname) {
  return pathname.endsWith("/index.html") || pathname.endsWith("/index.html/");
}

/**
 * Read and clear the route saved before a CDN-safe reload.
 * @returns {string}
 */
export function readPostReloadPath() {
  try {
    const value = sessionStorage.getItem(POST_RELOAD_PATH_KEY) || "";
    if (value) sessionStorage.removeItem(POST_RELOAD_PATH_KEY);
    return value;
  } catch (_) {
    return "";
  }
}

/**
 * Reload without requesting a virtual SPA path from object storage.
 * R2 public URLs only expose real keys such as /index.html — not /activity-center.
 */
export function reloadActivityPage() {
  try {
    const url = new URL(window.location.href);
    const appRoute = resolveCurrentAppRoute();
    sessionStorage.setItem(POST_RELOAD_PATH_KEY, `${appRoute}${url.search}${url.hash}`);

    if (isIndexHtmlEntry(url.pathname)) {
      window.location.reload();
      return;
    }

    url.pathname = resolveIndexHtmlPathname(url.pathname);
    window.location.assign(url.toString());
  } catch (_) {
    window.location.reload();
  }
}
