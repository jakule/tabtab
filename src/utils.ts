/**
 * Utility functions shared across the extension
 */

/**
 * Extract hostname from a URL
 * @param url The URL to extract hostname from
 * @returns The hostname or "other" if invalid
 */
export function getHost(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'other';
  }
}
