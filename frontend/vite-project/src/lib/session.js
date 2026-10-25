/* ============================================================
   Browser session helpers.

   A session is a JWT issued by the backend /login endpoint. The
   token is kept in localStorage so existing navigation keeps
   working; the backend remains the authority because /me rejects
   forged or expired tokens.
   ============================================================ */

import { TRANSLATION_URL } from "./serviceUrls.js";

const TOKEN_KEY = "token";
const USER_KEY = "user";

const API_BASE = TRANSLATION_URL;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* storage can be unavailable in private mode; nothing else to do */
  }
}

export function decodeTokenPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return null;

    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));

    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

async function postJSON(path, body) {
  if (!API_BASE) {
    throw new Error(
      "Authentication service URL is not configured for this build."
    );
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export async function loginRequest(identifier, password) {
  const data = await postJSON("/login", { identifier, password });

  if (!data?.token) {
    throw new Error("The server did not return a session token.");
  }

  saveSession(data.token, data.user);
  return data;
}

/**
 * Check the stored session.
 *
 * The token must be a structurally valid, unexpired JWT. When the
 * backend is reachable, /me is asked to confirm it. If the network is
 * unavailable we keep the locally valid session so offline navigation
 * still works; the backend still rejects the token on every real API
 * call. A rejected (401) token is always discarded.
 */
export async function verifySession() {
  const token = getToken();

  if (!token) return { valid: false, user: null };

  const payload = decodeTokenPayload(token);

  if (
    !payload ||
    typeof payload.exp !== "number" ||
    payload.exp * 1000 <= Date.now()
  ) {
    return { valid: false, user: null };
  }

  if (!API_BASE) {
    return { valid: true, user: getStoredUser() };
  }

  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, user: null };
    }

    if (!res.ok) {
      return { valid: true, user: getStoredUser() };
    }

    const data = await res.json();

    if (!data?.user) return { valid: false, user: null };

    saveSession(token, data.user);
    return { valid: true, user: data.user };
  } catch {
    return { valid: true, user: getStoredUser() };
  }
}
