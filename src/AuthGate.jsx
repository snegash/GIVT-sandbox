// src/AuthGate.jsx
// Shows a sign-in / create-account screen until the user is authenticated, then
// renders children. Usage in src/main.jsx:  <AuthGate><App /></AuthGate>
import React, { useEffect, useState } from "react";
import { signIn, signUp, getSession, onAuthChange } from "./auth";

const C = {
  ink: "#0E1116", inkSoft: "#2A2F3A", paper: "#F7F3EC", rule: "#D8CFBE",
  gold: "#B8862F", goldDeep: "#8C6420", teal: "#2D6E6A", rust: "#A04A1E",
};
const serif = "'Fraunces', Georgia, serif";
const sans = "'DM Sans', system-ui, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = checking
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange((s) => setSession(s));
  }, []);

  const submit = async () => {
    setErr("");
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true);
    try {
      if (tab === "signin") await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (e) {
      setErr(e?.message || "Authentication failed.");
    }
    setBusy(false);
  };

  if (session === undefined) {
    return <div style={{ fontFamily: sans, padding: 40, color: C.inkSoft }}>Loading…</div>;
  }
  if (session) return children;

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "11px 12px", marginTop: 6,
    border: `1px solid ${C.rule}`, borderRadius: 8, fontFamily: sans, fontSize: 14,
    background: "#fff", color: C.ink,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff",
        border: `1px solid ${C.rule}`, borderRadius: 14, padding: 28,
        boxShadow: "0 10px 40px rgba(14,17,22,0.08)" }}>
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.5,
          textTransform: "uppercase", color: C.gold }}>GIVT Sandbox</div>
        <h1 style={{ fontFamily: serif, fontSize: 26, color: C.ink, margin: "6px 0 2px" }}>
          {tab === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <div style={{ fontFamily: sans, fontSize: 13, color: C.inkSoft, marginBottom: 18 }}>
          Gamified · Individualized · Verified Talent
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {["signin", "signup"].map((t) => (
            <button key={t} onClick={() => { setTab(t); setErr(""); }}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                fontFamily: sans, fontSize: 13, fontWeight: 600,
                border: `1px solid ${tab === t ? C.ink : C.rule}`,
                background: tab === t ? C.ink : "#fff", color: tab === t ? "#fff" : C.inkSoft }}>
              {t === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <label style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft }}>Email
          <input type="email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} />
        </label>
        <div style={{ height: 12 }} />
        <label style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft }}>Password
          <input type="password" value={password}
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} />
        </label>

        {err && <div style={{ fontFamily: sans, fontSize: 12.5, color: C.rust, marginTop: 12 }}>{err}</div>}

        <button onClick={submit} disabled={busy}
          style={{ width: "100%", marginTop: 18, padding: "12px 0", borderRadius: 8,
            border: "none", cursor: busy ? "default" : "pointer", fontFamily: sans,
            fontSize: 14, fontWeight: 700, color: "#fff",
            background: busy ? C.goldDeep : C.gold, opacity: busy ? 0.8 : 1 }}>
          {busy ? "Working…" : tab === "signin" ? "Sign in" : "Create account · +500 GIVT"}
        </button>

        <div style={{ fontFamily: sans, fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 1.5 }}>
          After signing in, open “Create Account” inside the app to choose your role
          (Student / Advisor / Professor / Employer / Peer) and claim your tokens.
        </div>
      </div>
    </div>
  );
}
