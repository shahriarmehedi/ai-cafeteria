"use client";

import { useState, useRef, useEffect } from "react";
import { logoutAction } from "@/app/actions";
import { LogOut, Mail, Phone } from "lucide-react";

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
              <div style={{ marginTop: "8px", padding: "8px 10px", background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Wallet Balance</span>
                <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: 800 }}>৳{(session.balance !== undefined ? session.balance : 1000.00).toFixed(2)}</span>
              </div>
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
    </div>
  );
}
