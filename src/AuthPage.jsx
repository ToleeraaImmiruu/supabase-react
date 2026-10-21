import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }

  // Already logged in? Go to the products page.
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!email.trim() || password.length < 6) {
      setMessage({
        type: "error",
        text: "Enter your email and a password of at least 6 characters.",
      });
      return;
    }

    setBusy(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      setBusy(false);

      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }

      // If email confirmation is on, there is no session yet
      if (!data.session) {
        setMessage({
          type: "success",
          text: "Account created. Check your email to confirm it, then log in.",
        });
        setMode("login");
        return;
      }

      navigate("/");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);

      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }

      navigate("/");
    }
  }

  const isLogin = mode === "login";

  return (
    <main className="page">
      <div className="auth-card">
        <h1>{isLogin ? "Log in" : "Create account"}</h1>
        <p className="hint">
          {isLogin
            ? "Log in to add, edit, and delete your products."
            : "Sign up to start adding products."}
        </p>

        {message && (
          <div className={`notice notice--${message.type}`} role="status">
            {message.text}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>

          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Please wait..." : isLogin ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="switch-line">
          {isLogin ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(isLogin ? "signup" : "login");
              setMessage(null);
            }}
          >
            {isLogin ? "Create one" : "Log in"}
          </button>
        </p>

        <p className="switch-line">
          <Link to="/">Back to products</Link>
        </p>
      </div>
    </main>
  );
}

export default AuthPage;