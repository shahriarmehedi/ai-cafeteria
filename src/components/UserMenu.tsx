"use client";

import { useState, useRef, useEffect } from "react";
import { logoutAction, topUpWalletAction } from "@/app/actions";
import { LogOut, Mail, Phone, CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface Props {
  session: {
    name?: string | null;
    role: string;
    email?: string | null;
    phone?: string | null;
    balance?: number;
  };
}

export default function UserMenu({ session }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Top Up Modal State
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = session.name || "User";
  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const contactInfo = session.email || session.phone || "No contact info";

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const parts = [];
    for (let i = 0; i < value.length; i += 4) {
      parts.push(value.substring(i, i + 4));
    }
    setCardNumber(parts.join(" ").substring(0, 19));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (value.length >= 2) {
      setCardExpiry((value.substring(0, 2) + "/" + value.substring(2, 4)).substring(0, 5));
    } else {
      setCardExpiry(value);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0 || isNaN(amount)) {
      toast("Please enter a valid top-up amount", "error");
      return;
    }

    if (cardNumber.replace(/\s+/g, "").length < 16) {
      toast("Invalid card number", "error");
      return;
    }

    if (cardExpiry.length < 5) {
      toast("Invalid expiry date (MM/YY)", "error");
      return;
    }

    if (cardCvc.length < 3) {
      toast("Invalid security code (CVC)", "error");
      return;
    }

    setTopUpLoading(true);
    try {
      const res = await topUpWalletAction(amount);
      if (res.success) {
        toast(`Successfully recharged ৳${amount.toFixed(2)} to your wallet!`, "success");
        setShowTopUp(false);
        setCardNumber("");
        setCardExpiry("");
        setCardCvc("");
        setTopUpAmount("500");
        router.refresh();
      } else {
        toast(res.error || "Failed to complete top-up", "error");
      }
    } catch (err) {
      console.error(err);
      toast("An error occurred during recharge", "error");
    } finally {
      setTopUpLoading(false);
    }
  };

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      {/* Clickable User Avatar initials box */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          fontWeight: 700,
          fontSize: "12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          transition: "var(--transition)",
        }}
      >
        {initials}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: "absolute",
            top: "42px",
            right: 0,
            width: "240px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            zIndex: 1000,
          }}
        >
          {/* User details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Signed In As</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{displayName}</span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              {session.email ? <Mail size={12} /> : <Phone size={12} />}
              {contactInfo}
            </span>
            {session.role === "CUSTOMER" && (
              <>
                <div style={{ marginTop: "8px", padding: "8px 10px", background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Wallet Balance</span>
                  <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: 800 }}>৳{(session.balance !== undefined ? session.balance : 1000.00).toFixed(2)}</span>
                </div>
                <button
                  onClick={() => { setShowTopUp(true); setIsOpen(false); }}
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%", marginTop: "8px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "rgba(255,255,255,0.03)" }}
                >
                  <CreditCard size={12} />
                  <span>Recharge Wallet</span>
                </button>
              </>
            )}
          </div>

          <div style={{ height: "1px", background: "var(--border)" }}></div>

          {/* Action buttons */}
          <form action={logoutAction} style={{ width: "100%" }}>
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              style={{
                width: "100%",
                background: "rgba(239, 68, 68, 0.06)",
                borderColor: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <LogOut size={13} />
              <span>Logout</span>
            </button>
          </form>
        </div>
      )}

      {/* Simulated Credit Card Top-up Modal */}
      {showTopUp && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}>
          <div className="glass-panel animate-fade-in" style={{ width: "95%", maxWidth: "380px", padding: "24px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CreditCard size={18} style={{ color: "var(--success)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Simulate Wallet Recharge</h3>
              </div>
              <button
                onClick={() => setShowTopUp(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: "11px" }}>Select Recharge Amount (BDT)</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                  {["200", "500", "1000", "2000"].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`btn btn-secondary btn-sm ${topUpAmount === amt ? "active" : ""}`}
                      style={{
                        padding: "6px 0",
                        fontSize: "11px",
                        background: topUpAmount === amt ? "var(--success)" : "rgba(255,255,255,0.02)",
                        color: topUpAmount === amt ? "#000" : "var(--text-primary)",
                        borderColor: topUpAmount === amt ? "var(--success)" : "var(--border)",
                      }}
                    >
                      ৳{amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Or enter custom amount"
                  className="input-field"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  style={{ marginTop: "8px", fontSize: "13px" }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: "11px" }}>Card Number</label>
                <input
                  type="text"
                  placeholder="4000 1234 5678 9010"
                  className="input-field"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  style={{ fontSize: "13px" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "11px" }}>Expiration</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    className="input-field"
                    value={cardExpiry}
                    onChange={handleExpiryChange}
                    style={{ fontSize: "13px", textAlign: "center" }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "11px" }}>CVC / CVV</label>
                  <input
                    type="text"
                    placeholder="123"
                    maxLength={3}
                    className="input-field"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/[^0-9]/g, ""))}
                    style={{ fontSize: "13px", textAlign: "center" }}
                    required
                  />
                </div>
              </div>

              <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "8px", padding: "10px", fontSize: "11px", color: "var(--success)", display: "flex", gap: "6px", alignItems: "center" }}>
                <span>🔒</span>
                <span>Sandbox payment gateway simulation. No real money will be charged.</span>
              </div>

              <button
                type="submit"
                disabled={topUpLoading}
                className="btn btn-primary"
                style={{ width: "100%", height: "38px", background: "var(--success)", border: "none", color: "#000", fontSize: "13px", fontWeight: 700 }}
              >
                {topUpLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Processing...
                  </>
                ) : (
                  `Recharge Wallet (৳${Number(topUpAmount || 0).toFixed(2)})`
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
