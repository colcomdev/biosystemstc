/**
 * Centralized API & Asset URL resolution helper.
 * 
 * Supports both:
 * 1. Monolithic / Local development (Frontend + Express on same host: relative URLs)
 * 2. Decoupled deployment (Frontend on GitHub Pages, Backend on Render / Koyeb / Railway)
 * 
 * Set VITE_API_URL in .env or GitHub Actions secret (e.g. https://my-backend.onrender.com)
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Returns the fully qualified URL for an API endpoint.
 * Example: apiUrl('/api/gate/evaluate-access') -> 'https://backend.onrender.com/api/gate/evaluate-access'
 */
export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!API_BASE_URL) {
    return cleanEndpoint;
  }
  return `${API_BASE_URL}${cleanEndpoint}`;
}

/**
 * Resolves static or uploaded asset URLs (e.g., custom uploaded logos).
 * If the path starts with /uploads and VITE_API_URL is configured,
 * it prefixes the backend URL so the image loads correctly from the backend server.
 */
export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('/uploads') && API_BASE_URL) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}
