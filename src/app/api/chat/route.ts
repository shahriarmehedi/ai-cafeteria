import { NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";
import { getSession } from "@/lib/session";
import { AIService } from "./ai.service";
import { OrderService } from "./order.service";

const aiService = new AIService();
const orderService = new OrderService();

/**
 * API Route Handler for the AI Cafeteria Chatbot.
 * Acts as a thin controller that:
 * 1. Sanitizes inputs and retrieves user session/order contexts.
 * 2. Delegates user classification to the AIService.
 * 3. Orchestrates database mutations and resolves the business logic via the OrderService.
 * 4. Implements strict intent guardrails and logs structured system events.
 */
export async function POST(req: Request) {
  let sessionId = "temp-session";
  let message = "";
  let tableNumber = 0;

  try {
    const body = await req.json();
    message = body.message;
    sessionId = body.sessionId;
    tableNumber = body.tableNumber;

    if (!message || !sessionId) {
      console.warn({ event: "CHAT_CONTROLLER_BAD_REQUEST", details: "Missing message or sessionId" });
      return NextResponse.json({ error: "Missing message or sessionId" }, { status: 400 });
    }

    // 1. Record user message in the database for conversational log integrity
    await dbService.createChatMessage(sessionId, "user", message);

    // 2. Fetch live data context for the classifier
    const menuItems = await dbService.getMenuItems();
    const activeOrder = await orderService.getActiveOrderForSession(sessionId, tableNumber);

    // 3. Retrieve session for authentication mapping
    const session = await getSession();
    let walletBalance = 0;
    if (session) {
      const liveUser = await dbService.getUserByIdentifier(session.email || session.phone || "");
      walletBalance = liveUser?.balance !== undefined ? liveUser.balance : (session.role === "CUSTOMER" ? 1000.00 : 0);
    }

    // 4. Delegate to AI service for intent classification
    const history = await dbService.getChatMessages(sessionId);
    const recentHistory = history.map(msg => ({ role: msg.role, content: msg.content }));
    
    const classification = await aiService.parseUserIntent(
      message,
      recentHistory,
      menuItems,
      activeOrder,
      tableNumber,
      walletBalance
    );

    let finalResponse = classification.replyDraft;
    let orderPlaced = false;
    let orderUpdated = false;
    let responsePayload: any = null;

    // 5. Enforce intent classification guardrails & routing logic
    const userIntent = classification.confidence >= 0.6 ? classification.intent : "ESCALATION";

    switch (userIntent) {
      case "GENERAL_INQUIRY": {
        // AI Chef answers general menu details or provides meal classifications directly
        break;
      }

      case "ACCOUNT_MODIFICATION": {
        // Secure Bypass: Instantly block account modifications and display direct portal redirect instructions
        finalResponse = `To modify your account details (such as address, phone number, or payment methods), please log in to our secure portal and go to Account Settings. For security reasons, I cannot perform account changes in this chat.`;
        break;
      }

      case "ORDER_STATUS": {
        const orderIdInput = classification.extractedData?.orderId;
        const targetOrder = orderIdInput 
          ? await orderService.findOrder(orderIdInput) 
          : activeOrder;

        if (targetOrder) {
          const itemsList = targetOrder.items
            .map((it) => `${it.menuItemName} (x${it.quantity})`)
            .join(", ");
          
          let refundNote = "";
          if (targetOrder.refundStatus === "REFUNDED") {
            refundNote = " (Refunded BDT " + targetOrder.total + ")";
          } else if (targetOrder.refundStatus === "ESCALATED") {
            refundNote = " (Refund pending human manager review)";
          }

          finalResponse = `Order **${targetOrder.orderNumber}** containing [${itemsList}] is currently **${targetOrder.status}**${refundNote}. Total: ৳${targetOrder.total.toFixed(2)}.`;
          responsePayload = targetOrder;
          orderUpdated = true;
        } else {
          finalResponse = `I couldn't find any active orders for this table or account. If you just placed an order, please give the system a few seconds to process, or check your Order history.`;
        }
        break;
      }

      case "REFUND_REQUEST": {
        const orderIdInput = classification.extractedData?.orderId;
        const targetOrder = orderIdInput 
          ? await orderService.findOrder(orderIdInput) 
          : activeOrder;

        if (!targetOrder) {
          finalResponse = `I see you are requesting a refund or cancellation, but I could not find that order. Please specify your order number (e.g. CB-1002) so I can help you.`;
          break;
        }

        // AUTO-CANCEL GUARD: If the kitchen has not started cooking it (status is RECEIVED)
        if (targetOrder.status === "RECEIVED") {
          // DOUBLE-REFUND GUARD: reject if any refund already exists (prevents prompt-injection abuse)
          if (targetOrder.refundStatus) {
            finalResponse = `Order **${targetOrder.orderNumber}** already has a refund status of **${targetOrder.refundStatus}**. No further refund action can be taken on this order.`;
            break;
          }

          const reasonText = classification.extractedData?.reason || "Cancelled via AI Chef Chatbot";
          const { cancelOrderCustomerAction } = await import("@/app/actions");
          const cancelRes = await cancelOrderCustomerAction(targetOrder.id, reasonText);
          if (cancelRes.success && cancelRes.order) {
            finalResponse = `I have successfully cancelled your order **${targetOrder.orderNumber}** and automatically refunded ৳${targetOrder.total.toFixed(2)} back to your wallet balance because the kitchen has not yet started preparing it!`;
            responsePayload = cancelRes.order;
            orderPlaced = true; 
            orderUpdated = true;
          } else {
            finalResponse = `I tried to cancel your order, but the system rejected it: ${cancelRes.error || "Please try cancelling via your Order History."}`;
          }
          break;
        }

        // TERMINAL STATUS GUARD: order is already CANCELLED or COMPLETED
        if (["CANCELLED", "COMPLETED"].includes(targetOrder.status)) {
          finalResponse = `Order **${targetOrder.orderNumber}** is already **${targetOrder.status}**. No further refund or cancellation action is possible.`;
          break;
        }

        const eligibility = await orderService.verifyRefundEligibility(targetOrder.id);
        if (eligibility.eligible) {
          // Strict Guardrail: AI Chef flags the order in the database for human approval
          const reasonText = classification.extractedData?.reason || "Refund requested via AI Chef assistant";
          const updatedOrder = await orderService.flagOrderForHumanReview(targetOrder.id, reasonText);
          
          finalResponse = `Since the kitchen has already started preparing your order (**${targetOrder.status}**), I cannot cancel it automatically. However, I have successfully registered a refund request for Order **${targetOrder.orderNumber}** due to: "${reasonText}", and escalated it to our support team for manual review.`;
          responsePayload = updatedOrder;
          orderUpdated = true;
          
          console.info({ event: "REFUND_ESCALATION_SUCCESS", orderNumber: targetOrder.orderNumber, reason: reasonText });
        } else {
          finalResponse = `I cannot register a refund for Order **${targetOrder.orderNumber}** because it is not eligible: ${eligibility.reason || "Already processed."}`;
        }
        break;
      }

      case "ESCALATION": {
        // Fallback / Human Review Pipeline: updates active order status and directs to human assistance
        const reasonText = classification.extractedData?.reason || message || "User requested escalation";
        
        if (activeOrder) {
          const updatedOrder = await orderService.flagOrderForHumanReview(activeOrder.id, `Human Escalation requested: ${reasonText}`);
          responsePayload = updatedOrder;
          orderUpdated = true;
        }

        finalResponse = `I have escalated this conversation to a human support agent. A manager will check in on you at Table ${tableNumber || "your table"} shortly to assist you further.`;
        console.warn({ event: "HUMAN_ESCALATION_TRIGGERED", tableNumber, reason: reasonText });
        break;
      }

      case "PLACE_ORDER": {
        // Instant Ordering: LLM extracts items, but order is written strictly by the backend controller
        const items = classification.extractedData?.items;
        if (!items || items.length === 0) {
          finalResponse = `I wanted to help you place an order, but I couldn't identify the specific items from the menu. Can you please state exactly which food items you'd like?`;
          break;
        }

        const orderItems = [];
        for (const orderItem of items) {
          const item = menuItems.find(m => m.id === orderItem.itemId);
          if (item) {
            orderItems.push({
              menuItemId: item.id,
              menuItemName: item.name,
              price: item.price,
              quantity: orderItem.quantity || 1
            });
          }
        }

        if (orderItems.length > 0) {
          const { createOrderAction } = await import("@/app/actions");
          const orderRes = await createOrderAction({
            tableNumber: tableNumber,
            specialInstructions: classification.extractedData?.specialInstructions || null,
            items: orderItems,
          });

          if (orderRes.success && orderRes.order) {
            finalResponse = `I've placed your order directly! Your order number is **${orderRes.order.orderNumber}** containing: ${orderItems.map(i => `${i.menuItemName} (x${i.quantity})`).join(", ")}. It has been sent directly to the kitchen!`;
            responsePayload = orderRes.order;
            orderPlaced = true;
            console.info({ event: "ORDER_PLACED_VIA_CHAT", orderNumber: orderRes.order.orderNumber, tableNumber });
          } else {
            finalResponse = `I couldn't place your order: ${orderRes.error || "Please try ordering from our menu grid."}`;
          }
        } else {
          finalResponse = `I couldn't place that order because the items requested are currently out of stock. Please browse our menu for alternatives!`;
        }
        break;
      }

      default: {
        // Default Safety Net case
        finalResponse = `I'm sorry, I encountered an issue processing that request. I've alerted our team, and a support agent will assist you shortly.`;
        console.error({ event: "UNEXPECTED_INTENT_STATE", intent: classification.intent });
        break;
      }
    }

    // 6. Record model response in the database for log persistence
    await dbService.createChatMessage(sessionId, "model", finalResponse);

    return NextResponse.json({
      text: finalResponse,
      orderPlaced,
      orderUpdated,
      order: responsePayload
    });

  } catch (error) {
    console.error({
      event: "CHAT_CONTROLLER_CRITICAL_FAILURE",
      details: error instanceof Error ? error.message : error
    });

    // Webhook safety standard: return standard 500 error without leaking trace details
    return NextResponse.json(
      { error: "Internal Server Error. Chat assistant is temporarily unavailable." },
      { status: 500 }
    );
  }
}
