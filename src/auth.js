// src/auth.js — email/password auth against the Express API.
import { request, setToken, getToken } from "./api";

const listeners = new Set();
let session = null; // { user, token } | null
const emit = () => listeners.forEach((fn) => fn(session));

export async function signUp(email, password) {
  const r = await request("/auth/signup", { method: "POST", body: { email, password } });
  setToken(r.token);
  session = { user: r.user, token: r.token };
  emit();
  return session;
}

export async function signIn(email, password) {
  const r = await request("/auth/login", { method: "POST", body: { email, password } });
  setToken(r.token);
  session = { user: r.user, token: r.token };
  emit();
  return session;
}

export async function signOut() {
  setToken(null);
  session = null;
  emit();
}

// Validates the stored token with the server; returns { user, token } or null.
export async function getSession() {
  if (!getToken()) return null;
  try {
    const me = await request("/auth/me");
    session = { user: me.user, token: getToken() };
    return session;
  } catch {
    setToken(null);
    session = null;
    return null;
  }
}

export function onAuthChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
