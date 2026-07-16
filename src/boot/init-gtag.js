import { getGaMeasurementId } from "../lib/ga-client-id.js";
import { normalizeGaPagePath } from "../lib/ga-page-path.js";

function scheduleIdle(task, timeoutMs) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(task, { timeout: timeoutMs });
    return;
  }
  window.addEventListener("load", task, { once: true });
}

function wrapHistoryMethod(method, callback) {
  const original = history[method];
  history[method] = function () {
    original.apply(this, arguments);
    callback();
  };
}

export function initGtag() {
  const measurementId = getGaMeasurementId();
  if (!measurementId) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  function trackPageView() {
    gtag("config", measurementId, {
      page_path: normalizeGaPagePath(location.pathname),
      page_title: document.title,
    });
  }

  function loadGtagScript() {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onload = function () {
      gtag("js", new Date());
      trackPageView();
    };
    document.head.appendChild(script);
  }

  scheduleIdle(loadGtagScript, 2500);
  wrapHistoryMethod("pushState", trackPageView);
  wrapHistoryMethod("replaceState", trackPageView);
  window.addEventListener("popstate", trackPageView);

  scheduleIdle(function attachClickTracking() {
    document.addEventListener(
      "click",
      function (e) {
        const el =
          e.target.closest('button, a, [role="button"], input, select, textarea') || e.target;
        gtag("event", "click", {
          page_path: normalizeGaPagePath(location.pathname),
          element: el.tagName,
          element_id: el.id || undefined,
          element_class: typeof el.className === "string" ? el.className.slice(0, 100) : undefined,
        });
      },
      true,
    );
  }, 4000);
}
