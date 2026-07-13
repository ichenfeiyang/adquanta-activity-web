const AD_DID_NOT_RESPOND = "Ad did not respond, please try again";

/**
 * @param {{
 *   ms: number,
 *   isActive: () => boolean,
 *   onTimeout: () => void,
 * }} options
 */
export function createAdCallbackTimeout({ ms, isActive, onTimeout }) {
  let timeoutId = null;

  function clear() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function start() {
    clear();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!isActive()) return;
      onTimeout();
    }, ms);
  }

  return { clear, start, message: AD_DID_NOT_RESPOND };
}
