import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../ui/Field";
import Button from "../ui/Button";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 18 }}>
      <h2 style={{ marginBottom: 6 }}>Login</h2>
      <p style={{ marginTop: 0, color: "#666" }}>Access your CRM dashboard</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
        <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

        {err && <div style={{ color: "crimson", fontSize: 13 }}>{err}</div>}

        <Button type="submit" disabled={busy}>
          {busy ? "Logging in..." : "Login"}
        </Button>
      </form>

      <div style={{ marginTop: 14, fontSize: 13 }}>
        Don’t have an account? <Link to="/signup">Create one</Link>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
        Backend routes expected: <b>/api/auth/login</b>, <b>/api/auth/me</b>
      </div>
    </div>
  );
}
