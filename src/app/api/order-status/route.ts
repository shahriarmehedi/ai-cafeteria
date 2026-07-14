import { NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";
import { getSession } from "@/lib/session";

/**
 * Order Status API Route Handler.
 * Implements strict IDOR checks to verify that only authorized roles
 * (ADMIN, KITCHEN) or the owning customer can access order details.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access. Please log in." }, { status: 401 });
    }

    const order = await dbService.getOrder(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // IDOR Guardrail Check: Restrict access to order owners, admins, or kitchen staff
    const isOwner = session && (
      (session.email && order.customerEmail === session.email) ||
      (session.phone && order.customerPhone === session.phone)
    );

    if (session.role !== "ADMIN" && session.role !== "KITCHEN" && !isOwner) {
      return NextResponse.json({ error: "Access Denied: You do not own this order." }, { status: 403 });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    console.error("Order Status API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
