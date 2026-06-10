/**
 * Bind DOM nodes by element id or CSS selector.
 *
 * @param {Record<string, string | { selector: string }>} idMap
 */
export function bindPageElements(idMap) {
  const elements = {};
  for (const [key, value] of Object.entries(idMap)) {
    if (typeof value === "string") {
      elements[key] = document.getElementById(value);
      continue;
    }
    if (value && typeof value.selector === "string") {
      elements[key] = document.querySelector(value.selector);
    }
  }
  return elements;
}
