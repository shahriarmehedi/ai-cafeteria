"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction, demoLoginAction } from "@/app/actions";
import { Mail, Phone, Shield, ChefHat, User, ArrowRight, Loader2 } from "lucide-react";

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // OTP Simulation States
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect target after successful login (e.g. back to /table/1)
  const redirectTo = searchParams.get("redirectTo") || "/";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your email or phone number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await loginAction(identifier);
      if (res.error) {
        setError(res.error);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: "ADMIN" | "KITCHEN" | "CUSTOMER") => {
    setDemoLoading(role);
    setError(null);

    try {
      const res = await demoLoginAction(role);
      if (res.error) {
        setError(res.error);
      } else {
        // Enforce redirects back to scanned tables or default dashboards
        const defaultDest = role === "ADMIN" ? "/admin" : role === "KITCHEN" ? "/kitchen" : "/";
        const finalDest = searchParams.get("redirectTo") || defaultDest;
        router.push(finalDest);
        router.refresh();
      }
    } catch {
      setError("Demo login failed. Please try again.");
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="app-container" style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel animate-fade-in" style={{ width: "100%", padding: "32px 24px" }}>
        
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <span className="badge badge-info" style={{ marginBottom: "8px" }}>Contactless Dining</span>
          <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "8px" }}>Welcome to CampusBite</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Sign in passwordless or use a demo account to get started.
          </p>
        </div>

        {error && (
          <div className="badge badge-danger animate-fade-in" style={{ width: "100%", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "13px", textTransform: "none" }}>
            {error}
          </div>
        )}

        {/* Regular passwordless login */}
        {!otpSent ? (
          <form onSubmit={(e) => { e.preventDefault(); if (identifier.trim()) setOtpSent(true); else setError("Please enter your email or phone number."); }}>
            <div className="form-group">
              <label className="form-label">Email or Phone Number</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., student@campus.edu or +12345678"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading || !!demoLoading}
                  style={{ paddingLeft: "42px" }}
                />
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                  {identifier.includes("@") ? <Mail size={18} /> : <Phone size={18} />}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !!demoLoading}
              style={{ width: "100%", marginTop: "8px" }}
            >
              Continue Passwordless <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: "8px", padding: "12px", marginBottom: "16px", fontSize: "12px", color: "var(--info)" }}>
              🔑 Simulated OTP code sent to <strong>{identifier}</strong>. You can enter any 4-digit code (e.g., 1234) to sign in.
            </div>

            <div className="form-group">
              <label className="form-label">Enter 4-Digit OTP Code</label>
              <input
                type="text"
                maxLength={4}
                className="input-field"
                placeholder="0000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                style={{ textAlign: "center", fontSize: "20px", letterSpacing: "8px", fontWeight: 700 }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setOtpSent(false); setOtp(""); }}
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || otp.length < 4}
                style={{ flex: 1 }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify & Login"}
              </button>
            </div>
          </form>
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", margin: "32px 0", gap: "12px" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Quick Demo Login</span>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
        </div>

        {/* Demo Quick Logins */}
        <div className="quick-login-grid">
          <div className="quick-login-card" onClick={() => !loading && !demoLoading && handleDemoLogin("CUSTOMER")}>
            <div className="quick-login-icon">
              {demoLoading === "CUSTOMER" ? <Loader2 size={24} className="animate-spin" style={{ color: "var(--primary)" }} /> : <User size={24} style={{ color: "var(--info)" }} />}
            </div>
            <div className="quick-login-title">Customer</div>
            <div className="quick-login-desc">Browse & Order</div>
          </div>

          <div className="quick-login-card" onClick={() => !loading && !demoLoading && handleDemoLogin("KITCHEN")}>
            <div className="quick-login-icon">
              {demoLoading === "KITCHEN" ? <Loader2 size={24} className="animate-spin" style={{ color: "var(--primary)" }} /> : <ChefHat size={24} style={{ color: "var(--warning)" }} />}
            </div>
            <div className="quick-login-title">Kitchen</div>
            <div className="quick-login-desc">Manage Orders</div>
          </div>

          <div className="quick-login-card" onClick={() => !loading && !demoLoading && handleDemoLogin("ADMIN")}>
            <div className="quick-login-icon">
              {demoLoading === "ADMIN" ? <Loader2 size={24} className="animate-spin" style={{ color: "var(--primary)" }} /> : <Shield size={24} style={{ color: "var(--danger)" }} />}
            </div>
            <div className="quick-login-title">Admin</div>
            <div className="quick-login-desc">Stats & Menu</div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
