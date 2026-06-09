import { NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    // Only kitchen staff and admins can fetch the orders list
    if (!session || (session.role !== "KITCHEN" && session.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const orders = await dbService.getOrders();
    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Fetch Orders API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
