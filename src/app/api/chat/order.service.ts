import { dbService } from "@/lib/dbService";
import { Order } from "@/lib/mockDb";

export class OrderService {
  /**
   * Retrieves the latest active order (RECEIVED, PREPARING, READY) for a customer session or table.
   * @param sessionId - The current customer's chat session identifier.
   * @param tableNumber - The table number the customer is seated at.
   * @returns The active Order object or null if none found.
   */
  public async getActiveOrderForSession(
    sessionId: string,
    tableNumber: number
  ): Promise<Order | null> {
    try {
      const orders = await dbService.getOrders();
      // Filter orders by tableNumber and active statuses
      const activeOrders = orders.filter(
        (o) =>
          o.tableNumber === tableNumber &&
          ["RECEIVED", "PREPARING", "READY"].includes(o.status)
      );

      if (activeOrders.length === 0) {
        return null;
      }

      // Sort by creation time to get the latest one
      activeOrders.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return activeOrders[0];
    } catch (error) {
      console.error({
        event: "DB_GET_ACTIVE_ORDER_FAILED",
        sessionId,
        tableNumber,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /**
   * Resolves an order object by database ID or order number (e.g. "CB-1234").
   * @param identifier - The database ID or Order Number string.
   * @returns The resolved Order object or null if not found.
   */
  public async findOrder(identifier: string): Promise<Order | null> {
    try {
      const orders = await dbService.getOrders();
      const cleanId = identifier.trim().toUpperCase();
      const target = orders.find(
        (o) =>
          o.id === identifier ||
          o.orderNumber.toUpperCase() === cleanId ||
          o.orderNumber.replace("-", "").toUpperCase() === cleanId.replace("-", "")
      );
      return target || null;
    } catch (error) {
      console.error({
        event: "DB_FIND_ORDER_FAILED",
        identifier,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /**
   * Verifies if an order is eligible for a refund.
   * Business rules:
   * 1. Order must exist in the database.
   * 2. Order must not already be refunded.
   * 3. Order must not already be escalated for review.
   * @param identifier - The database ID or Order Number string.
   * @returns Verification result with eligibility status, failure reason (if ineligible), and the resolved Order.
   */
  public async verifyRefundEligibility(
    identifier: string
  ): Promise<{ eligible: boolean; reason?: string; order?: Order }> {
    const order = await this.findOrder(identifier);
    if (!order) {
      return { eligible: false, reason: "Order not found in the system." };
    }

    if (order.refundStatus === "REFUNDED") {
      return { eligible: false, reason: "Order has already been refunded.", order };
    }

    if (order.refundStatus === "ESCALATED") {
      return {
        eligible: false,
        reason: "Refund request is already escalated and pending human review.",
        order,
      };
    }

    return { eligible: true, order };
  }

  /**
   * Flags an order for human review in the database.
   * @param orderId - The database ID of the target order.
   * @param reason - The reason for escalation or human review.
   * @returns The updated Order object.
   */
  public async flagOrderForHumanReview(
    orderId: string,
    reason: string
  ): Promise<Order> {
    try {
      const updatedOrder = await dbService.updateOrder(orderId, {
        refundStatus: "ESCALATED",
        refundReason: reason,
      });
      if (!updatedOrder) {
        throw new Error(`Order ${orderId} not found or could not be updated.`);
      }
      return updatedOrder;
    } catch (error) {
      console.error({
        event: "DB_FLAG_ORDER_ESCALATED_FAILED",
        orderId,
        reason,
        error: error instanceof Error ? error.message : error,
      });
      throw new Error(`Failed to escalate order: ${orderId}`);
    }
  }
}
