import Link from "next/link";
import { getSession } from "@/lib/session";
import { dbService } from "@/lib/dbService";
import { logoutAction } from "@/app/actions";
import { LogOut, Coffee, Shield, ClipboardList, ChefHat } from "lucide-react";

export default async function Header() {
  const session = await getSession();
  const isMock = dbService.isMockMode();

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, width: "100%" }}>
      {/* Mock Mode Alert Banner */}
      {isMock && (
        <div className="warning-banner">
          <span>⚠️ Running in Demo Mode (Local File DB). Add DATABASE_URL to `.env.local` for MongoDB.</span>
        </div>
      )}

      <nav className="mobile-navbar">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
          <div
            style={{
              background: "var(--primary)",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Coffee size={18} />
          </div>
          <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.5px" }}>
            Campus<span style={{ color: "var(--primary)" }}>Bite</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {session ? (
            <>
              {/* Role Badges */}
              {session.role === "ADMIN" && (
                <Link href="/admin" className="badge badge-danger" style={{ textDecoration: "none" }}>
                  <Shield size={12} />
                  Admin
                </Link>
              )}
              {session.role === "KITCHEN" && (
                <Link href="/kitchen" className="badge badge-warning" style={{ textDecoration: "none" }}>
                  <ChefHat size={12} />
                  Kitchen
                </Link>
              )}
              {session.role === "CUSTOMER" && (
                <span className="badge badge-info hide-mobile">
                  <ClipboardList size={12} />
                  Customer
                </span>
              )}

              {/* Logged in User Indicator */}
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.name}
              </span>

              {/* Logout Button */}
              <form action={logoutAction} style={{ display: "inline" }}>
                <button
                  type="submit"
                  className="btn btn-secondary btn-icon btn-sm"
                  title="Logout"
                  style={{ width: "32px", height: "32px" }}
                >
                  <LogOut size={14} />
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
