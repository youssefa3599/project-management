import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../context/AuthContext";
import "./Register.css";

const Register: React.FC = () => {
  const [step, setStep] = useState<"register" | "verify">("register");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "viewer" as Role,
  });
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Step 1: Send verification code
  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/request-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send verification code");
      }

      // Success - move to verification step
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and create account
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/verify-and-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid verification code");
      }

      // Success - login and redirect
      login(data.token, data.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    setError("");
    setResendLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend code");
      }

      alert("New verification code sent!");
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };

  // Verification screen
  if (step === "verify") {
    return (
      <div className="register-container">
        <div className="register-card">
          <h2 className="register-title">Verify Your Email</h2>
          
          <div className="verification-info">
            <p>We've sent a 6-digit code to:</p>
            <p className="email-highlight">{formData.email}</p>
          </div>

          {error && <p className="register-error">{error}</p>}

          <form onSubmit={handleVerifyAndRegister}>
            <div className="form-group-verify">
              <label className="verify-label">Enter Verification Code</label>
              <input
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                className="register-input verification-input"
                autoFocus
              />
              <small className="code-hint">Code expires in 15 minutes</small>
            </div>

            <button 
              type="submit" 
              className="register-button" 
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? "Creating Account..." : "Verify & Create Account"}
            </button>
          </form>

          <div className="resend-section">
            <p className="resend-text">Didn't receive the code?</p>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendLoading}
              className="resend-button"
            >
              {resendLoading ? "Resending..." : "Resend Code"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setStep("register");
              setVerificationCode("");
              setError("");
            }}
            className="back-button"
          >
            ← Back to Registration
          </button>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="register-container">
      <div className="register-card">
        <h2 className="register-title">Create Account</h2>

        {error && <p className="register-error">{error}</p>}

        <form onSubmit={handleRequestVerification}>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
            className="register-input"
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
            className="register-input"
          />

          <input
            type="password"
            name="password"
            placeholder="Password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            className="register-input"
          />

          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="register-input"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>

          <button type="submit" className="register-button" disabled={loading}>
            {loading ? "Sending Code..." : "Continue →"}
          </button>
        </form>

        <p className="register-footer">
          Already have an account?{" "}
          <Link to="/login" className="register-link">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;