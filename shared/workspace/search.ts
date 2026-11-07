export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
export function searchPrefixes(values: string[]) {
  const prefixes = new Set<string>();
  for (const value of values) {
    const normalized = normalizeSearch(value);
    for (const term of [normalized, ...normalized.split(" ")]) {
      for (
        let i = 2;
        i <= Math.min(40, term.length) && prefixes.size < 512;
        i++
      )
        prefixes.add(term.slice(0, i));
    }
  }
  return [...prefixes];
}
