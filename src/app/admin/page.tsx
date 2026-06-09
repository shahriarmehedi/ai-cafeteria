import { getSession } from "@/lib/session";
import { dbService } from "@/lib/dbService";
import { redirect } from "next/navigation";
import AdminDashboardView from "@/components/AdminDashboardView";

export default async function AdminPage() {
  const session = await getSession();

  // Redirect if not logged in or not an administrator
  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }

  const menuItems = await dbService.getMenuItems();
  const orders = await dbService.getOrders();
  const tables = await dbService.getTables();

  return (
    <AdminDashboardView
      menuItems={menuItems}
      orders={orders}
      tables={tables}
      session={session}
    />
  );
}
