import { dbService } from "@/lib/dbService";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import TableOrderingView from "@/components/TableOrderingView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ number: string }>;
}

export default async function TablePage({ params }: PageProps) {
  const resolvedParams = await params;
  const tableNum = parseInt(resolvedParams.number, 10);

  if (isNaN(tableNum) || tableNum <= 0) {
    notFound();
  }

  // Security authorization check: Enforce user login to access dining table ordering
  const session = await getSession();
  if (!session) {
    redirect(`/login?redirectTo=/table/${tableNum}`);
  }

  // Load table from dbService
  let table = await dbService.getTableByNumber(tableNum);
  
  if (!table) {
    // Proactive table creation for demo purposes (auto-registers table if accessed)
    if (tableNum <= 20) {
      table = await dbService.createTable(tableNum);
    } else {
      notFound();
    }
  }

  if (table.status === "INACTIVE") {
    return (
      <div className="app-container" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div className="glass-panel">
          <span style={{ fontSize: "48px" }}>🔒</span>
          <h2 style={{ fontSize: "20px", fontWeight: 800, marginTop: "16px", marginBottom: "8px" }}>Table {tableNum} is Closed</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
            This table is currently inactive. Please check with the cafeteria administrator.
          </p>
          <a href="/" className="btn btn-secondary">Go to Homepage</a>
        </div>
      </div>
    );
  }

  const menuItems = await dbService.getMenuItems();

  return (
    <TableOrderingView
      tableNumber={tableNum}
      menuItems={menuItems}
      session={session}
    />
  );
}
