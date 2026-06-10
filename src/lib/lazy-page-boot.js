import { showToast } from "./activity-alert-ui.js";
import { PAGE_LOAD_FAILED_TITLE } from "./activity-messages.js";

function showChunkLoadError(pageLabel = "Page") {
  const message = `${pageLabel} failed to load. Please check your network and refresh.`;
  if (showToast(message, "warning", { title: PAGE_LOAD_FAILED_TITLE })) return;
  window.alert(message);
}

/**
 * @template T
 * @param {{
 *   pageLabel: string,
 *   logTag: string,
 *   loadModule: () => Promise<T>,
 *   init: (module: T) => unknown,
 * }} options
 */
export async function runLazyPageBoot({ pageLabel, logTag, loadModule, init }) {
  try {
    const module = await loadModule();
    const dispose = await Promise.resolve(init(module));
    return dispose ?? null;
  } catch (error) {
    console.error(`[${logTag}] Failed to load page module`, error);
    showChunkLoadError(pageLabel);
    return null;
  }
}
