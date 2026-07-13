import { onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { runLazyPageBoot } from "../lib/lazy-page-boot.js";
import { pageTitle } from "../lib/activity-pages.js";

/**
 * Lazy-load a page boot module after the Vue shell mounts.
 *
 * @param {string} routeName
 * @param {{
 *   logTag: string,
 *   loadModule: () => Promise<Record<string, unknown>>,
 *   bootstrap: (module: Record<string, unknown>, ctx: {
 *     router: import('vue-router').Router,
 *     route: import('vue-router').RouteLocationNormalizedLoaded,
 *   }) => unknown,
 * }} options
 */
export function useLazyActivityPage(routeName, { logTag, loadModule, bootstrap }) {
  const route = useRoute();
  const router = useRouter();
  let dispose = null;
  const modulePromise = loadModule();

  onMounted(async () => {
    dispose = await runLazyPageBoot({
      pageLabel: pageTitle(routeName),
      logTag,
      loadModule: () => modulePromise,
      init: (module) => bootstrap(module, { router, route }),
    });
  });

  onUnmounted(() => {
    if (typeof dispose === "function") {
      dispose();
    }
    dispose = null;
  });
}
