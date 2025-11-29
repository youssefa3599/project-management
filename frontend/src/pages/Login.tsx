import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const { login, resendVerificationCode, user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect after login
  useEffect(() => {
    if (!loading && user) {
      const path = user.role === "admin" ? "/admin/dashboard" : "/dashboard";
      navigate(path, { replace: true });
    }
  }, [loading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);

    try {
      await login(email, password);
      // Navigation handled by useEffect above
    } catch (err: any) {
      // Check if error is due to unverified email
      if (err.needsVerification) {
        setNeedsVerification(true);
        setVerificationEmail(err.email || email);
        setError("Please verify your email before logging in. Check your inbox for the verification code.");
      } else {
        setError(err.message || "Login failed");
      }
    }
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationCode(verificationEmail || email);
      setError("Verification code resent! Check your email.");
    } catch (err: any) {
      setError(err.message || "Failed to resend verification code");
    }
  };

  return (
    <div className="container">
      <form onSubmit={handleSubmit} className="card">
        <h2 className="title">Login</h2>

        {error && (
          <div className="error">
            <p>{error}</p>
            {needsVerification && (
              <div style={{ marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  style={{
                    fontSize: "14px",
                    textDecoration: "underline",
                    background: "transparent",
                    border: "none",
                    color: "#007bff",
                    cursor: "pointer",
                    padding: "5px 0",
                  }}
                >
                  Resend Verification Code
                </button>
              </div>
            )}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="button" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-sm text-center mt-3">
          Don't have an account?{" "}
          <Link to="/register" className="link">
            Register here
          </Link>
        </p>
      </form>
    </div>
  );
}