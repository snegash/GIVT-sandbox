// src/api.js — low-level client for the GIVT Express API (JWT in localStorage).
const BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3001" : "")).replace(/\/$/, "");

let token = localStorage.getItem("givt_token") || null;

export function setToken(t) {
  token = t || null;
  if (t) localStorage.setItem("givt_token", t);
  else localStorage.removeItem("givt_token");
}
export function getToken() {
  return token;
}

export async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || "HTTP " + res.status);
  return data;
}
