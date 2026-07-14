import { getSession } from "@/lib/session";
import { dbService } from "@/lib/dbService";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Coffee, ChefHat, Shield, QrCode, ArrowRight } from "lucide-react";

export default async function Home() {
  const session = await getSession();

  // If customer is logged in, find their latest ordered table and redirect directly to it
  if (session && session.role === "CUSTOMER") {
    try {
      const allOrders = await dbService.getOrders();
      const customerOrders = allOrders.filter((o) => {
        return !!(
          (session.email && o.customerEmail === session.email) ||
          (session.phone && o.customerPhone === session.phone)
        );
      });

      if (customerOrders.length > 0) {
        customerOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const latestOrder = customerOrders[0];
        redirect(`/table/${latestOrder.tableNumber}`);
      }
    } catch (err) {
      console.error("Error finding customer's last ordered table:", err);
    }
  }

  const tables = await dbService.getTables();
  const allOrders = await dbService.getOrders();

  // Identify tables with active orders (RECEIVED, PREPARING, READY)
  const runningTableNumbers = new Set(
    allOrders
      .filter((o) => ["RECEIVED", "PREPARING", "READY"].includes(o.status))
      .map((o) => o.tableNumber)
  );

  // Identify logged-in customer's last used table
  let lastUsedTableNumber: number | null = null;
  if (session) {
    const customerOrders = allOrders.filter((o) => {
      return !!(
        (session.email && o.customerEmail === session.email) ||
        (session.phone && o.customerPhone === session.phone)
      );
    });
    if (customerOrders.length > 0) {
      customerOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      lastUsedTableNumber = customerOrders[0].tableNumber;
    }
  }

  return (
    <div className="app-container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px", minHeight: "80vh", justifyContent: "center" }}>
      
      {/* Brand Hero */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            background: "var(--primary-light)",
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)",
            margin: "0 auto 12px auto",
          }}
        >
          <Coffee size={28} />
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Campus<span style={{ color: "var(--primary)" }}>Bite</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
          Contactless university cafeteria ordering.
        </p>
      </div>

      {/* Main Action Box: Table Selector */}
      <div className="glass-panel" style={{ background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <QrCode size={18} style={{ color: "var(--primary)" }} />
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Select a Table to Order</h2>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
          Tap on your table number to simulate scanning a table QR code and browse the menu:
        </p>

        {/* Visual Table Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {tables.map((table) => {
            const hasRunningOrder = runningTableNumbers.has(table.number);
            const isLastUsed = table.number === lastUsedTableNumber;

            let cardBorder = table.status === "INACTIVE" ? "transparent" : "var(--border)";
            let cardBg = "rgba(255,255,255,0.01)";
            let badgeText = "";
            let badgeColor = "var(--text-muted)";

            if (hasRunningOrder) {
              cardBorder = "1.5px solid var(--warning)";
              cardBg = "rgba(245, 158, 11, 0.05)";
              badgeText = "Running Order";
              badgeColor = "var(--warning)";
            } else if (isLastUsed) {
              cardBorder = "1.5px solid var(--info)";
              cardBg = "rgba(14, 165, 233, 0.05)";
              badgeText = "Last Used";
              badgeColor = "var(--info)";
            }

            return (
              <Link
                key={table.id}
                href={`/table/${table.number}`}
                className="quick-login-card"
                style={{
                  textDecoration: "none",
                  padding: "16px 12px",
                  border: cardBorder,
                  opacity: table.status === "INACTIVE" ? 0.4 : 1,
                  pointerEvents: table.status === "INACTIVE" ? "none" : "auto",
                  background: cardBg,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "18px", fontWeight: 800 }}>T-{table.number}</span>
                <span style={{ fontSize: "10px", color: badgeColor, marginTop: "2px", fontWeight: badgeText ? 600 : 400 }}>
                  {badgeText || (table.status === "ACTIVE" ? "Open" : "Closed")}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Staff Portals */}
      <div className="glass-panel" style={{ padding: "16px 20px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px" }}>
          Cafeteria Staff Access
        </h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link
            href="/kitchen"
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, gap: "6px", fontSize: "13px", justifyContent: "center" }}
          >
            <ChefHat size={14} style={{ color: "var(--warning)" }} /> Kitchen KDS
          </Link>
          <Link
            href="/admin"
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, gap: "6px", fontSize: "13px", justifyContent: "center" }}
          >
            <Shield size={14} style={{ color: "var(--danger)" }} /> Admin Panel
          </Link>
        </div>
      </div>

      {/* User Session Info */}
      {session && (
        <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
          Signed in as <strong>{session.name}</strong> ({session.role})
        </div>
      )}
    </div>
  );
}
