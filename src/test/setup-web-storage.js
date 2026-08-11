class MemoryStorage {
  #entries = new Map();

  get length() {
    return this.#entries.size;
  }

  clear() {
    this.#entries.clear();
  }

  getItem(key) {
    const normalizedKey = String(key);
    return this.#entries.has(normalizedKey) ? this.#entries.get(normalizedKey) : null;
  }

  key(index) {
    return [...this.#entries.keys()][Number(index)] ?? null;
  }

  removeItem(key) {
    this.#entries.delete(String(key));
  }

  setItem(key, value) {
    this.#entries.set(String(key), String(value));
  }
}

if (typeof globalThis.sessionStorage === "undefined") {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
}
