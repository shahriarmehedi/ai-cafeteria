import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { MenuItem, Order } from "@/lib/mockDb";

export interface IntentResponse {
  intent: "ORDER_STATUS" | "REFUND_REQUEST" | "ACCOUNT_MODIFICATION" | "ESCALATION" | "GENERAL_INQUIRY" | "PLACE_ORDER";
  confidence: number;
  extractedData?: {
    orderId?: string;
    tableNumber?: number;
    amount?: number;
    reason?: string;
    items?: Array<{ itemId: string; quantity: number }>;
    specialInstructions?: string;
  };
  replyDraft: string;
}

export class AIService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "YOUR_GEMINI_API_KEY_HERE" && apiKey.trim() !== "") {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Parse user intent using Gemini Structured JSON schema.
   * If Gemini API key is missing or calls fail, it gracefully falls back to the offline classifier.
   */
  public async parseUserIntent(
    message: string,
    history: Array<{ role: string; content: string }>,
    menuItems: MenuItem[],
    activeOrder: Order | null,
    tableNumber: number
  ): Promise<IntentResponse> {
    const menuContext = menuItems
      .map(
        (item) =>
          `- ${item.name} (${item.category}): ৳${item.price.toFixed(2)}. Description: ${item.description}. Status: ${item.status}. ID: ${item.id}`
      )
      .join("\n");

    const orderContext = activeOrder
      ? `The customer has an active order:
- Order Number: ${activeOrder.orderNumber}
- Current Status: ${activeOrder.status}
- Items: ${activeOrder.items.map((it) => `${it.menuItemName} (x${it.quantity})`).join(", ")}
- Total: ৳${activeOrder.total.toFixed(2)}
- refundStatus: ${activeOrder.refundStatus || "NONE"}`
      : "The customer has no active orders at this table or under their account currently.";

    if (!this.genAI) {
      console.warn({ event: "GEMINI_API_KEY_MISSING", message: "Using offline local AI assistant fallback." });
      return this.generateLocalAIResponse(message, menuItems, activeOrder, tableNumber);
    }

    try {
      const systemInstruction = `
You are the intent classification brain of CampusBite AI Assistant (for Table ${tableNumber || "unknown"}).
Your primary role is to analyze the user's message, along with the conversation history and menu context, and classify their intent into exactly one of the following categories:

1. **ORDER_STATUS**: Asking about order status, tracking updates, or what was ordered.
2. **REFUND_REQUEST**: Requesting a refund, cancellation with reimbursement, or money back for a past or active order.
3. **ACCOUNT_MODIFICATION**: Asking to modify personal details (e.g. change address, phone number, email, or payment method).
4. **ESCALATION**: Requesting human support, demanding a manager, expressing high frustration, or describing severe food safety/delivery failures.
5. **PLACE_ORDER**: Explicitly requesting to place an order, purchase, or buy food items directly (e.g., "I want to order tea", "please order a burger", "buy 2 fries").
6. **GENERAL_INQUIRY**: General greetings, questions about what is on the menu, meal time inquiries (e.g. "what's for breakfast?"), price queries, recommendations, or generic chit-chat.

For GENERAL_INQUIRY, formulate the complete, helpful draft response in 'replyDraft' based on the menu and dining guidelines. Recommend items by appending recommendations using standard text (e.g., "I recommend the Masala Chai"). If recommending items, you MUST output their exact database IDs (e.g. 'item-tea') in the recommended card triggers by appending '[RECOMMEND: item-id1, item-id2]' to the end of the text.
For other intents, the backend will execute actions, but you should still provide a draft response or keep 'replyDraft' concise.

Guidelines:
- Categorize user's input with a confidence score between 0.0 and 1.0.
- Extract any mentioned order ID (e.g. CB-1002), table number, refund amount, or reasons.
- For PLACE_ORDER, map the requested item names to the exact database item IDs in 'items' array. If they use a generic word like 'tea' or 'coffee', map it to the closest matching in-stock item ID from the menu.

Menu Context:
${menuContext}

Current Order Context:
${orderContext}
`;

      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              intent: {
                type: SchemaType.STRING,
                format: "enum",
                enum: ["ORDER_STATUS", "REFUND_REQUEST", "ACCOUNT_MODIFICATION", "ESCALATION", "GENERAL_INQUIRY", "PLACE_ORDER"]
              },
              confidence: { type: SchemaType.NUMBER },
              extractedData: {
                type: SchemaType.OBJECT,
                properties: {
                  orderId: { type: SchemaType.STRING },
                  tableNumber: { type: SchemaType.INTEGER },
                  amount: { type: SchemaType.NUMBER },
                  reason: { type: SchemaType.STRING },
                  items: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        itemId: { type: SchemaType.STRING },
                        quantity: { type: SchemaType.INTEGER }
                      },
                      required: ["itemId", "quantity"]
                    }
                  },
                  specialInstructions: { type: SchemaType.STRING }
                }
              },
              replyDraft: { type: SchemaType.STRING }
            },
            required: ["intent", "confidence", "replyDraft"]
          }
        }
      });

      // Prepare Gemini history content
      const recentHistory = history.length > 9 ? history.slice(-9) : history;
      const contents = recentHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      // Append current message
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await model.generateContent({ contents });
      const text = response.response.text();
      
      const parsed: IntentResponse = JSON.parse(text);
      console.log({ event: "LLM_PARSE_SUCCESS", intent: parsed.intent, confidence: parsed.confidence });
      return parsed;

    } catch (error) {
      console.error({
        event: "LLM_PARSE_ERROR",
        details: error instanceof Error ? error.message : error
      });
      // Graceful fallback to offline local AI assistant
      return this.generateLocalAIResponse(message, menuItems, activeOrder, tableNumber);
    }
  }

  /**
   * Offline local rule-based AI classifier fallback.
   * Matches regex and keywords to return a uniform IntentResponse structure.
   */
  public generateLocalAIResponse(
    message: string,
    menuItems: MenuItem[],
    activeOrder: Order | null,
    tableNumber: number
  ): IntentResponse {
    const lowerMsg = message.toLowerCase();
    const inStock = menuItems.filter((item) => item.status === "IN_STOCK");

    // 1. Account Modification Checks
    const isAccountMod =
      lowerMsg.includes("address") ||
      lowerMsg.includes("phone number") ||
      lowerMsg.includes("payment method") ||
      lowerMsg.includes("profile") ||
      lowerMsg.includes("credit card") ||
      lowerMsg.includes("change my");
    
    if (isAccountMod) {
      return {
        intent: "ACCOUNT_MODIFICATION",
        confidence: 0.9,
        replyDraft: "For security reasons, account modifications cannot be done via chat."
      };
    }

    // 2. Refund / Escalation Checks
    const isRefund =
      lowerMsg.includes("refund") ||
      lowerMsg.includes("money back") ||
      lowerMsg.includes("pay me back") ||
      lowerMsg.includes("reimburse");
    
    const isEscalation =
      lowerMsg.includes("escalate") ||
      lowerMsg.includes("human") ||
      lowerMsg.includes("manager") ||
      lowerMsg.includes("support") ||
      lowerMsg.includes("person") ||
      lowerMsg.includes("complaint");

    if (isRefund) {
      return {
        intent: "REFUND_REQUEST",
        confidence: 0.9,
        extractedData: {
          orderId: activeOrder?.orderNumber || undefined,
          amount: activeOrder?.total || undefined,
          reason: "Customer requested refund via fallback channel"
        },
        replyDraft: "Refund request initiated."
      };
    }

    if (isEscalation) {
      return {
        intent: "ESCALATION",
        confidence: 0.95,
        extractedData: {
          orderId: activeOrder?.orderNumber || undefined,
          reason: "Customer requested escalation to a human support agent"
        },
        replyDraft: "Escalating query to support agent."
      };
    }

    // 3. Direct Ordering Checks
    const isOrder =
      lowerMsg.includes("order") ||
      lowerMsg.includes("buy") ||
      lowerMsg.includes("purchase") ||
      lowerMsg.includes("want a") ||
      lowerMsg.includes("get me");

    if (isOrder) {
      const orderedItems: Array<{ itemId: string; quantity: number }> = [];
      const matched = inStock.filter((item) => {
        const name = item.name.toLowerCase();
        const desc = item.description.toLowerCase();
        
        if (lowerMsg.includes(name)) return true;
        if (lowerMsg.includes("tea") && name.includes("tea")) return true;
        if (lowerMsg.includes("coffee") && name.includes("coffee")) return true;
        if (lowerMsg.includes("burger") && name.includes("burger")) return true;
        if (lowerMsg.includes("fries") && name.includes("fries")) return true;
        return false;
      });

      if (matched.length > 0) {
        matched.forEach((m) => orderedItems.push({ itemId: m.id, quantity: 1 }));
        return {
          intent: "PLACE_ORDER",
          confidence: 0.85,
          extractedData: {
            items: orderedItems
          },
          replyDraft: `Placing order for matched items: ${matched.map((m) => m.name).join(", ")}`
        };
      }
    }

    // 4. Order Status Inquiry Checks
    const isStatus =
      lowerMsg.includes("status") ||
      lowerMsg.includes("track") ||
      lowerMsg.includes("where is my") ||
      lowerMsg.includes("prepared") ||
      lowerMsg.includes("ready");
    
    if (isStatus) {
      return {
        intent: "ORDER_STATUS",
        confidence: 0.9,
        extractedData: {
          orderId: activeOrder?.orderNumber || undefined
        },
        replyDraft: "Checking order status."
      };
    }

    // 5. Default General Inquiry / Recommendations
    let replyText = "Hello! I am the CampusBite AI Chef. How can I assist you with the menu today?";
    const recommendIds: string[] = [];

    // Breakfast keyword
    if (lowerMsg.includes("breakfast") || lowerMsg.includes("morning")) {
      const breakfastItems = inStock.filter(
        (item) => item.name.toLowerCase().includes("tea") || item.name.toLowerCase().includes("coffee")
      );
      if (breakfastItems.length > 0) {
        replyText = `🤖 [AI Chef] For breakfast, I highly recommend our refreshing beverages: ${breakfastItems
          .map((b) => `**${b.name}** (৳${b.price})`)
          .join(" and ")}.`;
        recommendIds.push(...breakfastItems.map((b) => b.id));
      }
    } else if (lowerMsg.includes("recommend") || lowerMsg.includes("suggest") || lowerMsg.includes("hungry")) {
      const sample = inStock.slice(0, 2);
      if (sample.length > 0) {
        replyText = `🤖 [AI Chef] Here is what I suggest: try our delicious **${sample[0].name}** (৳${sample[0].price}).`;
        recommendIds.push(...sample.map((s) => s.id));
      }
    } else {
      const sample = inStock.slice(0, 1);
      if (sample.length > 0) {
        recommendIds.push(sample[0].id);
      }
    }

    if (recommendIds.length > 0) {
      replyText += ` [RECOMMEND: ${recommendIds.join(", ")}]`;
    }

    return {
      intent: "GENERAL_INQUIRY",
      confidence: 0.8,
      replyDraft: replyText
    };
  }
}
