export function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  // Prefer filename* (RFC 5987) — carries the full Unicode name
  const extMatch = /filename\*=UTF-8''([^\s;]+)/i.exec(contentDisposition);
  if (extMatch) {
    try {
      return decodeURIComponent(extMatch[1]);
    } catch {
      /* fall through to basic filename */
    }
  }

  const match =
    /filename="([^"]+)"/.exec(contentDisposition) ??
    /filename=([a-zA-Z0-9\u10D0-\u10FF._-]+)/.exec(contentDisposition);
  return match?.[1] ?? null;
}
