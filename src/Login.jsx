import { useState } from "react";
import { supabase } from "./supabase.js";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email o contraseña incorrectos");
    } else {
      onLogin(data.user);
    }
    setLoading(false);
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f3ef",
      fontFamily: "'Instrument Sans', sans-serif",
      padding: 16,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 20,
        padding: "36px 32px",
        width: "100%",
        maxWidth: 380,
        boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
        border: "1px solid #e8e4dc",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏪</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "#18181b" }}>LocalApp</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>Gestión integral para tu negocio</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Email</label>
            <input
              style={{ background: "#f8f7f4", border: "1.5px solid #e2dfd8", borderRadius: 9, padding: "10px 14px", fontSize: 14, color: "#18181b", width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Contraseña</label>
            <input
              style={{ background: "#f8f7f4", border: "1.5px solid #e2dfd8", borderRadius: 9, padding: "10px 14px", fontSize: 14, color: "#18181b", width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ background: "#fee2e2", border: "1.5px solid #fecaca", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#7f1d1d", fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: "#18181b", color: "#fff", border: "none", borderRadius: 9, padding: "12px", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", marginTop: 4, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#ccc" }}>
          LocalApp v1.0 — Gestión local
        </div>
      </div>
    </div>
  );
}
