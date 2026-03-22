export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u10D0-\u10FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
