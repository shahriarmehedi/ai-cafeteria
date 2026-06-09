import { getSession } from "@/lib/session";
import { dbService } from "@/lib/dbService";
import { redirect } from "next/navigation";
import KitchenDashboardView from "@/components/KitchenDashboardView";

export default async function KitchenPage() {
  const session = await getSession();

  // Redirect if not logged in or unauthorized
  if (!session || (session.role !== "KITCHEN" && session.role !== "ADMIN")) {
    redirect("/login");
  }

  const initialOrders = await dbService.getOrders();

  return (
    <KitchenDashboardView
      initialOrders={initialOrders}
      session={session}
    />
  );
}
