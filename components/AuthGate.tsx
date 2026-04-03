import { CSSProperties, FormEvent, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const base = {
  obsidian: "#0A0806",
  charcoal: "#1A1410",
  espresso: "#2C1F14",
  gold: "#E8A838",
  cream: "#F5ECD7",
  grad: "linear-gradient(135deg,#C47A3A 0%,#E8A838 50%,#F5C842 100%)",
};

type AuthMode = "login" | "signup";

export default function AuthGate() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const title = useMemo(() => (mode === "login" ? "WELCOME BACK" : "JOIN BIG HOMIE"), [mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              referral_code_used: referralCode.trim().toUpperCase() || undefined,
            },
          },
        });

        if (signUpError) throw signUpError;
        setMessage("Account created. Check your email to confirm, then log in.");
        setMode("login");
      }
    } catch (caughtError: unknown) {
      const text = caughtError instanceof Error ? caughtError.message : "Could not authenticate.";
      setError(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at top, #2C1F14 0%, ${base.obsidian} 55%)`,
        padding: "20px",
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
      }}
    >
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          min-height: 100%;
          background: #0A0806;
        }

        body {
          overflow-x: hidden;
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-text-fill-color: #F5ECD7 !important;
          -webkit-box-shadow: 0 0 0 1000px #0F0B08 inset !important;
          box-shadow: 0 0 0 1000px #0F0B08 inset !important;
          caret-color: #F5ECD7;
          border: 1px solid rgba(232,168,56,0.2) !important;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: "460px",
          background: `linear-gradient(145deg,${base.charcoal},${base.espresso})`,
          border: "1px solid rgba(232,168,56,0.25)",
          borderRadius: "20px",
          padding: "28px",
          color: base.cream,
        }}
      >
        <div style={{ fontSize: "10px", letterSpacing: "4px", color: base.gold, marginBottom: "10px" }}>BIG HOMIE</div>
        <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: "38px", letterSpacing: "2px", marginBottom: "16px" }}>
          {title}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="Email"
            style={inputStyle}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            minLength={8}
            placeholder="Password"
            style={inputStyle}
          />
          {mode === "signup" && (
            <input
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              placeholder="Referral code (optional)"
              style={inputStyle}
            />
          )}
        </div>

        {error && <div style={{ marginTop: "12px", color: "#E05252", fontSize: "13px" }}>{error}</div>}
        {message && <div style={{ marginTop: "12px", color: "#4CAF7D", fontSize: "13px" }}>{message}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "18px",
            border: "none",
            borderRadius: "10px",
            padding: "12px 16px",
            cursor: "pointer",
            fontWeight: 800,
            background: base.grad,
            color: base.obsidian,
          }}
        >
          {loading ? "Working..." : mode === "login" ? "Log In" : "Create Account"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((currentMode) => (currentMode === "login" ? "signup" : "login"));
            setError("");
            setMessage("");
          }}
          style={{
            width: "100%",
            marginTop: "10px",
            border: "1px solid rgba(232,168,56,0.25)",
            borderRadius: "10px",
            padding: "10px 12px",
            cursor: "pointer",
            background: "transparent",
            color: base.gold,
            fontWeight: 700,
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#0F0B08",
  border: "1px solid rgba(232,168,56,0.2)",
  borderRadius: "10px",
  padding: "12px 14px",
  color: "#F5ECD7",
  fontSize: "14px",
  outline: "none",
};
