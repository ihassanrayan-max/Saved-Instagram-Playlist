export function memoryStorage(seed = {}) {
  const rows = structuredClone(seed);
  return {
    rows, fail: false, writes: [],
    async get(keys) {
      await Promise.resolve();
      return structuredClone(Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, rows[key]])));
    },
    async set(values) {
      if (this.fail) throw new Error('QUOTA_BYTES exceeded');
      this.writes.push(Object.keys(values)); Object.assign(rows, structuredClone(values));
    },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete rows[key]; },
  };
}
