/**
 * Browser-side Anthropic API key handling.
 *
 * sessionStorage ONLY — never localStorage, never a cookie, never a URL. The
 * key is read solely to place it in an analyze request body and is never
 * rendered back to the user after entry.
 */

export const API_KEY_STORAGE_KEY = "research_lens_anthropic_api_key";

export const API_KEY_DISCLOSURE =
  "Your API key is used only for the current browser session and is not stored by Research Lens.";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Storage can throw when the browser blocks site data.
    return null;
  }
}

export function readApiKey(): string | null {
  const value = storage()?.getItem(API_KEY_STORAGE_KEY) ?? null;
  return value && value.length > 0 ? value : null;
}

export function saveApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed.length === 0) return;
  try {
    storage()?.setItem(API_KEY_STORAGE_KEY, trimmed);
  } catch {
    // Ignore: the caller reflects state from a subsequent read.
  }
}

export function clearApiKey(): void {
  try {
    storage()?.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
