import Link from "next/link";
import { getSession } from "@/lib/session";
import { dbService } from "@/lib/dbService";
import { logoutAction } from "@/app/actions";
import { Coffee, Shield, ClipboardList, ChefHat } from "lucide-react";
import UserMenu from "@/components/UserMenu";

export default async function Header() {
  const session = await getSession();
  let latestSession: any = null;
  
  if (session) {
    const liveUser = await dbService.getUserByIdentifier(session.email || session.phone || "");
    latestSession = {
      id: session.id,
      email: session.email,
      phone: session.phone,
      name: session.name,
      role: session.role,
      balance: liveUser?.balance !== undefined ? liveUser.balance : (session.role === "CUSTOMER" ? 1000.00 : 0)
    };
  }

  const isMock = dbService.isMockMode();

  return (
    <header style={{ borderBottom: "1px solid var(--border)", background: "rgba(9, 9, 11, 0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 200 }}>
      {/* Simulation Banner */}
      {isMock && (
        <div style={{ background: "rgba(245, 158, 11, 0.15)", borderBottom: "1px solid rgba(245, 158, 11, 0.25)", color: "var(--warning)", padding: "6px 12px", textAlign: "center", fontSize: "11px", fontWeight: 600 }}>
          ⚡ CampusBite Simulator Mode (Prisma database offline)
        </div>
      )}

      <nav className="mobile-navbar" style={{ padding: 0 }}>
        <div style={{ width: "100%", maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px" }}>
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
                color: "#09090b",
              }}
            >
              <Coffee size={18} />
            </div>
            <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.5px" }}>
              Campus<span style={{ color: "var(--primary)" }}>Bite</span>
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {latestSession ? (
              <>
                {/* Role Badges */}
                {latestSession.role === "ADMIN" && (
                  <Link href="/admin" className="badge badge-danger" style={{ textDecoration: "none" }}>
                    <Shield size={12} />
                    Admin
                  </Link>
                )}
                {latestSession.role === "KITCHEN" && (
                  <Link href="/kitchen" className="badge badge-warning" style={{ textDecoration: "none" }}>
                    <ChefHat size={12} />
                    Kitchen
                  </Link>
                )}
                {latestSession.role === "CUSTOMER" && (
                  <span className="badge badge-info hide-mobile">
                    <ClipboardList size={12} />
                    Customer
                  </span>
                )}

                <UserMenu session={latestSession} />
              </>
            ) : (
              <Link href="/login" className="btn btn-primary btn-sm">
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
