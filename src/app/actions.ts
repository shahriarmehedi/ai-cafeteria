"use server";

import { dbService } from "@/lib/dbService";
import { setSession, clearSession, getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

// Passwordless Login / Register Action
export async function loginAction(identifier: string) {
  if (!identifier || identifier.trim() === "") {
    return { error: "Email or phone number is required" };
  }

  const isEmail = identifier.includes("@");
  let user;

  if (isEmail) {
    user = await dbService.getUserByEmail(identifier.trim());
  } else {
    user = await dbService.getUserByPhone(identifier.trim());
  }

  // If user does not exist, automatically register them as a CUSTOMER (passwordless)
  if (!user) {
    user = await dbService.createUser({
      email: isEmail ? identifier.trim() : null,
      phone: !isEmail ? identifier.trim() : null,
      name: isEmail ? identifier.split("@")[0] : "Customer " + identifier.slice(-4),
      role: "CUSTOMER",
    });
  }

  await setSession({
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
  });

  revalidatePath("/");
  return { success: true, user };
}

// Quick Demo Login Action
export async function demoLoginAction(role: "ADMIN" | "KITCHEN" | "CUSTOMER"): Promise<{ success: boolean; user?: any; error?: string }> {
  let email = "";
  if (role === "ADMIN") email = "admin@campusbite.com";
  else if (role === "KITCHEN") email = "kitchen@campusbite.com";
  else email = "student@campusbite.com";

  let user = await dbService.getUserByEmail(email);

  if (!user) {
    // Fallback registration in case db reset
    user = await dbService.createUser({
      email,
      phone: role === "ADMIN" ? "1234567890" : role === "KITCHEN" ? "0987654321" : "5555555555",
      name: role === "ADMIN" ? "Admin User" : role === "KITCHEN" ? "Kitchen Staff" : "Alex Smith",
      role,
    });
  }

  await setSession({
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
  });

  revalidatePath("/");
  return { success: true, user };
}

// Logout Action
export async function logoutAction() {
  await clearSession();
  revalidatePath("/");
}

// Create Order Action
export async function createOrderAction(orderData: {
  tableNumber: number;
  specialInstructions?: string | null;
  items: { menuItemId: string; menuItemName: string; price: number; quantity: number }[];
}) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Authentication required. Please log in first to place your order." };
  }

  // Menu Item Stock Check
  for (const oItem of orderData.items) {
    const dbItem = await dbService.getMenuItem(oItem.menuItemId);
    if (!dbItem) {
      return { success: false, error: `Item ${oItem.menuItemName} not found in cafeteria menu.` };
    }
    if (dbItem.stock < oItem.quantity) {
      return { success: false, error: `Sorry, ${oItem.menuItemName} is out of stock. Only ${dbItem.stock} left.` };
    }
  }

  // Payment simulation deduction check
  const total = orderData.items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const user = await dbService.getUserByIdentifier(session.email || session.phone || "");
  if (user && user.role === "CUSTOMER") {
    const currentBalance = user.balance !== undefined ? user.balance : 1000.0;
    if (currentBalance < total) {
      return { success: false, error: `Insufficient wallet balance. Total is ৳${total.toFixed(2)} but your wallet has only ৳${currentBalance.toFixed(2)}.` };
    }
    const newBalance = currentBalance - total;
    await dbService.updateUserBalance(user.id, newBalance);
  }

  // Decrement Stock
  for (const oItem of orderData.items) {
    const dbItem = await dbService.getMenuItem(oItem.menuItemId);
    if (dbItem) {
      const newStock = dbItem.stock - oItem.quantity;
      await dbService.updateMenuItem(dbItem.id, { 
        stock: newStock,
        status: newStock <= 0 ? "OUT_OF_STOCK" : dbItem.status 
      });
    }
  }

  const order = await dbService.createOrder({
    tableNumber: orderData.tableNumber,
    customerEmail: session.email || null,
    customerPhone: session.phone || null,
    customerName: session.name || "Table " + orderData.tableNumber,
    specialInstructions: orderData.specialInstructions || null,
    items: orderData.items,
  });

  revalidatePath("/kitchen");
  revalidatePath("/admin");
  revalidatePath(`/table/${orderData.tableNumber}`);
  revalidatePath(`/order/${order.id}`);

  return { success: true, order };
}

// Get Customer Orders Action
export async function getCustomerOrdersAction() {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Authentication required. Please log in first." };
  }

  try {
    const allOrders = await dbService.getOrders();
    const customerOrders = allOrders.filter((o) => {
      const matchCustomer = session && (
        (session.email && o.customerEmail === session.email) ||
        (session.phone && o.customerPhone === session.phone)
      );
      return !!matchCustomer;
    });

    return { success: true, orders: customerOrders };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch orders" };
  }
}

// Update Order Status Action (Kitchen / Admin)
export async function updateOrderStatusAction(orderId: string, status: string) {
  const session = await getSession();
  if (!session || (session.role !== "KITCHEN" && session.role !== "ADMIN")) {
    return { error: "Unauthorized access" };
  }

  const order = await dbService.updateOrder(orderId, { status });
  if (!order) {
    return { error: "Order not found" };
  }

  revalidatePath("/kitchen");
  revalidatePath("/admin");
  revalidatePath(`/order/${orderId}`);
  revalidatePath(`/table/${order.tableNumber}`);

  return { success: true, order };
}

// Admin: Manage Menu Items Action
export async function manageMenuItemAction(
  operation: "CREATE" | "UPDATE" | "DELETE",
  id?: string,
  data?: {
    name: string;
    description: string;
    price: number;
    image: string;
    category: string;
    status: string;
  }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Unauthorized access" };
  }

  if (operation === "CREATE" && data) {
    const item = await dbService.createMenuItem(data);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, item };
  }

  if (operation === "UPDATE" && id && data) {
    const item = await dbService.updateMenuItem(id, data);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, item };
  }

  if (operation === "DELETE" && id) {
    const success = await dbService.deleteMenuItem(id);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, deleted: success };
  }

  return { error: "Invalid operation arguments" };
}

export async function manageTableAction(
  operation: "CREATE" | "UPDATE" | "DELETE",
  data: { number?: number; status?: string; id?: string }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Unauthorized access" };
  }

  if (operation === "CREATE" && data.number) {
    const table = await dbService.createTable(data.number);
    revalidatePath("/admin");
    return { success: true, table };
  }

  if (operation === "UPDATE" && data.id && data.status) {
    const table = await dbService.updateTable(data.id, { status: data.status });
    revalidatePath("/admin");
    revalidatePath(`/table/${data.number}`);
    return { success: true, table };
  }

  if (operation === "DELETE" && data.id) {
    const success = await dbService.deleteTable(data.id);
    revalidatePath("/admin");
    return { success: true, deleted: success };
  }

  return { error: "Invalid operation arguments" };
}

// Kitchen / Admin: Resolve Escalated Refund Requests
export async function resolveEscalationAction(orderId: string, resolution: "REFUNDED" | "REFUND_DENIED") {
  const session = await getSession();
  if (!session || (session.role !== "KITCHEN" && session.role !== "ADMIN")) {
    return { error: "Unauthorized access" };
  }

  const order = await dbService.getOrder(orderId);
  if (!order) {
    return { error: "Order not found" };
  }

  const updates: any = { refundStatus: resolution };
  if (resolution === "REFUNDED") {
    const refundAmt = order.refundAmount || order.total;
    updates.refundAmount = refundAmt;

    // Refund simulation credit back to customer wallet
    const customer = await dbService.getUserByIdentifier(order.customerEmail || order.customerPhone || "");
    if (customer) {
      const currentBalance = customer.balance !== undefined ? customer.balance : 1000.0;
      const newBalance = currentBalance + refundAmt;
      await dbService.updateUserBalance(customer.id, newBalance);
    }
  }

  const updatedOrder = await dbService.updateOrder(orderId, updates);

  revalidatePath("/kitchen");
  revalidatePath("/admin");
  revalidatePath(`/table/${order.tableNumber}`);

  return { success: true, order: updatedOrder };
}

// Customer: Simulated Wallet Top-up Action
export async function topUpWalletAction(amount: number) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }

  if (amount <= 0 || isNaN(amount)) {
    return { success: false, error: "Invalid top-up amount" };
  }

  const user = await dbService.getUserByIdentifier(session.email || session.phone || "");
  if (!user) {
    return { success: false, error: "User profile not found" };
  }

  const currentBalance = user.balance !== undefined ? user.balance : 1000.0;
  const newBalance = currentBalance + amount;
  await dbService.updateUserBalance(user.id, newBalance);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/kitchen");

  return { success: true, newBalance };
}

// Customer: Cancel Active Order (Before Kitchen Preparation starts)
export async function cancelOrderCustomerAction(orderId: string, reason: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }

  const order = await dbService.getOrder(orderId);
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  // Check ownership
  const isOwner = (session.email && order.customerEmail === session.email) ||
                  (session.phone && order.customerPhone === session.phone);
  if (!isOwner && session.role !== "ADMIN") {
    return { success: false, error: "Access Denied: You do not own this order." };
  }

  // Check if cooking already started
  if (order.status !== "RECEIVED") {
    return { success: false, error: `Cannot cancel order. The kitchen has already set the status to ${order.status}.` };
  }

  // Update order status to CANCELLED and refund automatically
  const updates = {
    status: "CANCELLED",
    refundStatus: "REFUNDED",
    refundAmount: order.total,
    refundReason: `Customer Cancelled: ${reason}`,
  };

  // Re-credit customer balance
  const customer = await dbService.getUserByIdentifier(order.customerEmail || order.customerPhone || "");
  if (customer) {
    const currentBalance = customer.balance !== undefined ? customer.balance : 1000.0;
    await dbService.updateUserBalance(customer.id, currentBalance + order.total);
  }

  // Restore Stock amounts!
  for (const oItem of order.items) {
    const dbItem = await dbService.getMenuItem(oItem.menuItemId);
    if (dbItem) {
      const restoredStock = dbItem.stock + oItem.quantity;
      await dbService.updateMenuItem(dbItem.id, {
        stock: restoredStock,
        status: "IN_STOCK"
      });
    }
  }

  const updatedOrder = await dbService.updateOrder(orderId, updates);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/kitchen");
  revalidatePath(`/table/${order.tableNumber}`);

  return { success: true, order: updatedOrder };
}
