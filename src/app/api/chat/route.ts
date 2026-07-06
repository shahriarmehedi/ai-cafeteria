import { NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";
import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from "@google/generative-ai";
import { getSession } from "@/lib/session";

// Dynamic local AI assistant that ONLY recommends in-stock items present in the database menu list
function generateLocalAIResponse(
  message: string,
  menuItems: any[],
  activeOrder: any | null,
  tableNumber: number
): { 
  text: string; 
  recommendIds: string[]; 
  shouldPlaceOrder?: boolean;
  shouldRefundOrder?: boolean;
  shouldEscalateOrder?: boolean;
  refundAmount?: number;
  refundReason?: string;
} {
  const lowerMsg = message.toLowerCase();
  const inStock = menuItems.filter((item) => item.status === "IN_STOCK");

  // 0.0 Refund or Escalation request check (fallback mode)
  const isRefundRequest = lowerMsg.includes("refund") || lowerMsg.includes("money back") || lowerMsg.includes("pay me back") || lowerMsg.includes("reimburse");
  const isEscalationRequest = lowerMsg.includes("escalate") || lowerMsg.includes("human") || lowerMsg.includes("manager") || lowerMsg.includes("support") || lowerMsg.includes("person") || lowerMsg.includes("complaint");

  if (isRefundRequest || isEscalationRequest) {
    if (activeOrder) {
      if (isRefundRequest) {
        const refundAmount = activeOrder.total;
        if (refundAmount > 500) {
          return {
            text: `🤖 [AI Chef] Your refund request for Order **${activeOrder.orderNumber}** (total ৳${refundAmount.toFixed(2)}) exceeds my direct authorization limit of ৳500. I have escalated this request to a human manager for manual review.`,
            recommendIds: [],
            shouldEscalateOrder: true,
            refundReason: "Customer requested a refund in fallback mode (amount exceeds limit)"
          };
        } else {
          return {
            text: `🤖 [AI Chef] I have successfully processed a refund of **৳${refundAmount.toFixed(2)}** for Order **${activeOrder.orderNumber}** due to your request. The amount will be credited back to you.`,
            recommendIds: [],
            shouldRefundOrder: true,
            refundAmount: refundAmount,
            refundReason: "Customer requested a refund in fallback mode"
          };
        }
      } else {
        return {
          text: `🤖 [AI Chef] Understood. I have escalated Order **${activeOrder.orderNumber}** to a human support manager for manual review.`,
          recommendIds: [],
          shouldEscalateOrder: true,
          refundReason: "Customer requested escalation to a human"
        };
      }
    } else {
      return {
        text: `🤖 [AI Chef] I see you want to request a refund or contact support, but I couldn't find any active orders for this table or session. Please verify your order or check in with counter staff.`,
        recommendIds: []
      };
    }
  }

  // 0. Direct Ordering intent check (e.g. "order tea", "I want to buy burger" in fallback mode)
  const isOrderRequest = lowerMsg.includes("order") || lowerMsg.includes("buy") || lowerMsg.includes("purchase") || lowerMsg.includes("want a") || lowerMsg.includes("want some") || lowerMsg.includes("get me");
  if (isOrderRequest) {
    const orderedItems = inStock.filter(item => {
      const name = item.name.toLowerCase();
      const desc = item.description.toLowerCase();
      
      // Direct matches
      if (lowerMsg.includes(name)) return true;
      
      // Keyword mappings
      if (lowerMsg.includes("tea") || lowerMsg.includes("chai")) {
        return name.includes("tea") || name.includes("chai") || desc.includes("tea") || desc.includes("chai");
      }
      if (lowerMsg.includes("coffee")) {
        return name.includes("coffee") || desc.includes("coffee");
      }
      if (lowerMsg.includes("burger")) {
        return name.includes("burger") || desc.includes("burger");
      }
      if (lowerMsg.includes("fries")) {
        return name.includes("fries") || desc.includes("fries");
      }
      if (lowerMsg.includes("biryani")) {
        return name.includes("biryani") || desc.includes("biryani");
      }
      if (lowerMsg.includes("khichuri")) {
        return name.includes("khichuri") || desc.includes("khichuri");
      }
      if (lowerMsg.includes("brownie")) {
        return name.includes("brownie") || desc.includes("brownie");
      }
      if (lowerMsg.includes("ice cream") || lowerMsg.includes("sundae")) {
        return name.includes("ice cream") || name.includes("sundae") || desc.includes("ice cream") || desc.includes("sundae");
      }
      if (lowerMsg.includes("chicken")) {
        return name.includes("chicken");
      }
      
      const words = lowerMsg.split(/\s+/).filter(w => w.length >= 3 && w !== "order" && w !== "want" && w !== "some" && w !== "please");
      return words.some(word => name.includes(word));
    });

    if (orderedItems.length > 0) {
      const itemToOrder = orderedItems[0];
      return {
        text: `🤖 [AI Chef] Placing your order for: ${itemToOrder.name}`,
        recommendIds: [itemToOrder.id],
        shouldPlaceOrder: true
      };
    }
  }

  // 0.1 Breakfast/Lunch/Dinner queries
  if (lowerMsg.includes("breakfast") || lowerMsg.includes("morning")) {
    const breakfastItems = inStock.filter(item => {
      const name = item.name.toLowerCase();
      const desc = item.description.toLowerCase();
      const cat = item.category.toLowerCase();
      return (
        name.includes("chai") || name.includes("coffee") || name.includes("tea") || name.includes("egg") || name.includes("toast") || name.includes("bread") || name.includes("paratha") ||
        desc.includes("breakfast") || desc.includes("morning") || desc.includes("tea") || desc.includes("coffee") ||
        cat === "beverages"
      );
    });
    if (breakfastItems.length > 0) {
      const listStr = breakfastItems.map(item => `• **${item.name}** (৳${item.price.toFixed(2)}) - ${item.description}`).join("\n");
      return {
        text: `🤖 [AI Chef] Analyzing our menu, I've found these items suitable for breakfast:\n\n${listStr}\n\nWhat would you like me to order for you?`,
        recommendIds: breakfastItems.map(i => i.id)
      };
    }
  }

  if (lowerMsg.includes("lunch") || lowerMsg.includes("dinner") || lowerMsg.includes("night") || lowerMsg.includes("afternoon") || lowerMsg.includes("meal")) {
    const mainItems = inStock.filter(item => item.category === "MAIN_COURSES");
    if (mainItems.length > 0) {
      const listStr = mainItems.map(item => `• **${item.name}** (৳${item.price.toFixed(2)}) - ${item.description}`).join("\n");
      return {
        text: `🤖 [AI Chef] For lunch or dinner, we have these main courses available:\n\n${listStr}\n\nWhat would you like me to order for you?`,
        recommendIds: mainItems.map(i => i.id)
      };
    }
  }

  if (lowerMsg.includes("snack") || lowerMsg.includes("evening") || lowerMsg.includes("bite")) {
    const snackItems = inStock.filter(item => item.category === "APPETIZERS" || item.category === "DESSERTS");
    if (snackItems.length > 0) {
      const listStr = snackItems.map(item => `• **${item.name}** (৳${item.price.toFixed(2)}) - ${item.description}`).join("\n");
      return {
        text: `🤖 [AI Chef] For snacks or desserts, here are some great options:\n\n${listStr}\n\nWhat would you like me to order for you?`,
        recommendIds: snackItems.map(i => i.id)
      };
    }
  }

  // 0.2 Order Status Query (highest priority check)
  if (
    lowerMsg.includes("status") ||
    lowerMsg.includes("order") ||
    lowerMsg.includes("track") ||
    lowerMsg.includes("my food") ||
    lowerMsg.includes("where is my") ||
    lowerMsg.includes("preparing") ||
    lowerMsg.includes("ready") ||
    lowerMsg.includes("what did i") ||
    lowerMsg.includes("what is my") ||
    lowerMsg.includes("current order") ||
    lowerMsg.includes("progress")
  ) {
    if (activeOrder) {
      const itemDetails = activeOrder.items
        .map((it: any) => `${it.menuItemName} (x${it.quantity})`)
        .join(", ");
      
      let statusDesc = "";
      switch (activeOrder.status) {
        case "RECEIVED":
          statusDesc = "received by the kitchen and is currently in the queue.";
          break;
        case "PREPARING":
          statusDesc = "being freshly prepared by our chefs right now.";
          break;
        case "READY":
          statusDesc = "ready for pickup! Please collect it from the counter.";
          break;
        case "COMPLETED":
          statusDesc = "completed and served. Hope you enjoyed your meal!";
          break;
        case "CANCELLED":
          statusDesc = "cancelled.";
          break;
        default:
          statusDesc = `currently in status: ${activeOrder.status}.`;
      }

      return {
        text: `🤖 [AI Chef] Your active order **${activeOrder.orderNumber}** containing [${itemDetails}] is ${statusDesc} Total: ৳${activeOrder.total.toFixed(2)}.`,
        recommendIds: [],
      };
    } else {
      return {
        text: `🤖 [AI Chef] I couldn't find any active orders for Table ${tableNumber || "this table"}. Would you like to check out our menu and place an order?`,
        recommendIds: [],
      };
    }
  }

  // 1. Specific category query checks
  if (lowerMsg.includes("drink") || lowerMsg.includes("beverage") || lowerMsg.includes("tea") || lowerMsg.includes("coffee") || lowerMsg.includes("water") || lowerMsg.includes("juice") || lowerMsg.includes("chai") || lowerMsg.includes("cold coffee") || lowerMsg.includes("masala chai")) {
    const drinks = inStock.filter(item => item.category === "BEVERAGES");
    if (drinks.length > 0) {
      const recs = drinks.slice(0, 2);
      return {
        text: `🤖 [AI Chef] Yes! We have refreshing beverages available: ${recs.map(r => `**${r.name}** (৳${r.price.toFixed(2)})`).join(" and ")}. ${recs[0]?.description || ""}`,
        recommendIds: recs.map(r => r.id),
      };
    }
  }

  if (lowerMsg.includes("dessert") || lowerMsg.includes("sweet") || lowerMsg.includes("brownie") || lowerMsg.includes("ice cream") || lowerMsg.includes("sundae") || lowerMsg.includes("cake")) {
    const desserts = inStock.filter(item => item.category === "DESSERTS");
    if (desserts.length > 0) {
      const recs = desserts.slice(0, 2);
      return {
        text: `🤖 [AI Chef] For something sweet, try our delicious desserts: ${recs.map(r => `**${r.name}** (৳${r.price.toFixed(2)})`).join(" and ")}. ${recs[0]?.description || ""}`,
        recommendIds: recs.map(r => r.id),
      };
    }
  }

  if (lowerMsg.includes("appetizer") || lowerMsg.includes("starter") || lowerMsg.includes("fries") || lowerMsg.includes("loaded") || lowerMsg.includes("side")) {
    const appetizers = inStock.filter(item => item.category === "APPETIZERS");
    if (appetizers.length > 0) {
      const recs = appetizers.slice(0, 2);
      return {
        text: `🤖 [AI Chef] How about some delicious appetizers? I recommend our ${recs.map(r => `**${r.name}** (৳${r.price.toFixed(2)})`).join(" or ")}.`,
        recommendIds: recs.map(r => r.id),
      };
    }
  }

  if (lowerMsg.includes("main") || lowerMsg.includes("meal") || lowerMsg.includes("lunch") || lowerMsg.includes("dinner") || lowerMsg.includes("burger") || lowerMsg.includes("biryani") || lowerMsg.includes("khichuri") || lowerMsg.includes("kacchi")) {
    const mains = inStock.filter(item => item.category === "MAIN_COURSES");
    if (mains.length > 0) {
      const recs = mains.slice(0, 2);
      return {
        text: `🤖 [AI Chef] For a satisfying meal, we suggest: ${recs.map(r => `**${r.name}** (৳${r.price.toFixed(2)})`).join(" and ")}. ${recs[0]?.description || ""}`,
        recommendIds: recs.map(r => r.id),
      };
    }
  }

  // 2. Dynamic Item Search: Scan all items in the database to see if they match the user query
  const matchedItem = inStock.find((item) => {
    const itemNameLower = item.name.toLowerCase();
    // Split item name into words (e.g. "Kacchi", "Biryani") and filter out short filler words
    const words = itemNameLower.split(/\s+/).filter((w: string) => w.length >= 3);
    return lowerMsg.includes(itemNameLower) || 
           itemNameLower.includes(lowerMsg) ||
           words.some((word: string) => lowerMsg.includes(word));
  });

  if (matchedItem) {
    return {
      text: `🤖 [AI Chef] Yes, we have **${matchedItem.name}** (৳${matchedItem.price.toFixed(2)}) ready in the kitchen! ${matchedItem.description}`,
      recommendIds: [matchedItem.id],
    };
  }

  // 3. Specific menu query check for non-available items (e.g., "do you have pizza" where pizza is not on menu)
  if (
    lowerMsg.includes("have") ||
    lowerMsg.includes("get") ||
    lowerMsg.includes("serve") ||
    lowerMsg.includes("is there") ||
    lowerMsg.includes("do you") ||
    lowerMsg.includes("want to buy") ||
    lowerMsg.includes("can i buy") ||
    lowerMsg.includes("sell")
  ) {
    return {
      text: `🤖 [AI Chef] I'm sorry, we don't serve that item on our menu. Please check out our live menu list or ask me for recommendations!`,
      recommendIds: [],
    };
  }

  // 4. Stock queries
  if (lowerMsg.includes("out of stock") || lowerMsg.includes("available")) {
    const outOfStock = menuItems.filter((i) => i.status === "OUT_OF_STOCK");
    if (outOfStock.length > 0) {
      return {
        text: `🤖 [AI Chef] Currently, the following items are out of stock: ${outOfStock.map((i) => i.name).join(", ")}. Everything else is available!`,
        recommendIds: [],
      };
    } else {
      return {
        text: "🤖 [AI Chef] All cafeteria menu items are currently fully in stock and ready to order!",
        recommendIds: [],
      };
    }
  }

  if (inStock.length === 0) {
    return {
      text: "🤖 [AI Chef] I'm sorry, our kitchen is currently completely out of stock on all menu items!",
      recommendIds: [],
    };
  }

  // 5. General Recommendation request
  if (lowerMsg.includes("recommend") || lowerMsg.includes("suggest") || lowerMsg.includes("food") || lowerMsg.includes("eat") || lowerMsg.includes("hungry")) {
    const mains = inStock.filter(item => item.category === "MAIN_COURSES");
    const nonMains = inStock.filter(item => item.category !== "MAIN_COURSES");
    
    const recs = [];
    if (mains.length > 0) recs.push(mains[Math.floor(Math.random() * mains.length)]);
    if (nonMains.length > 0) recs.push(nonMains[Math.floor(Math.random() * nonMains.length)]);
    
    // Fallback if we didn't get 2 items
    if (recs.length < 2 && inStock.length > recs.length) {
      for (const item of inStock) {
        if (!recs.includes(item)) {
          recs.push(item);
          if (recs.length === 2) break;
        }
      }
    }
    
    if (recs.length > 0) {
      return {
        text: `🤖 [AI Chef] Here is what I suggest from our live menu: try our delicious **${recs[0].name}** (৳${recs[0].price.toFixed(2)}) - ${recs[0].description}.` + 
              (recs[1] ? ` For variety, you should also try our **${recs[1].name}** (৳${recs[1].price.toFixed(2)}).` : "") + 
              ` You can order them directly below!`,
        recommendIds: recs.map(r => r.id),
      };
    }
  }

  // 6. Default Greeting
  const sample = inStock.slice(0, 2);
  return {
    text: `🤖 [AI Chef] Hello! I am the CampusBite AI Assistant. I can recommend dishes, check prices, track your order status, or add items to your cart. Today we have delicious options like ${sample.map(s => `**${s.name}**`).join(" and ")} ready to order. What are you in the mood for today?`,
    recommendIds: sample.map(r => r.id),
  };
}

export async function POST(req: Request) {
  let sessionId = "temp-session";
  let message = "";
  let tableNumber = 0;
  let menuItems: any[] = [];
  let activeOrder: any = null;
  let session: any = null;

  try {
    const body = await req.json();
    message = body.message;
    sessionId = body.sessionId;
    tableNumber = body.tableNumber;

    if (!message || !sessionId) {
      return NextResponse.json({ error: "Missing message or sessionId" }, { status: 400 });
    }

    // Save user message to database
    await dbService.createChatMessage(sessionId, "user", message);

    // Get current menu to feed into AI context
    menuItems = await dbService.getMenuItems();
    const menuContext = menuItems
      .map(
        (item) =>
          `- ${item.name} (${item.category}): ৳${item.price.toFixed(2)}. Description: ${item.description}. Status: ${item.status}. ID: ${item.id}`
      )
      .join("\n");

    // Get session to help query active order for customer
    session = await getSession();

    // Fetch latest active order for this table/customer to provide context to Gemini
    if ((tableNumber && tableNumber > 0) || session) {
      try {
        const allOrders = await dbService.getOrders();
        // Filter orders by table or customer identifier
        const tableOrders = allOrders.filter((o) => {
          const matchTable = tableNumber && tableNumber > 0 && o.tableNumber === tableNumber;
          const matchCustomer = session && (
            (session.email && o.customerEmail === session.email) ||
            (session.phone && o.customerPhone === session.phone)
          );
          return !!(matchTable || matchCustomer);
        });

        if (tableOrders.length > 0) {
          // Get the most recent active order first (RECEIVED, PREPARING, READY)
          const active = tableOrders.filter(o => o.status !== "COMPLETED" && o.status !== "CANCELLED");
          if (active.length > 0) {
            active.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            activeOrder = active[0];
          } else {
            tableOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            activeOrder = tableOrders[0];
          }
        }
      } catch (err) {
        console.error("Error fetching orders for chat context:", err);
      }
    }

    let orderContext = "The customer has no active orders at this table or under their account currently.";
    if (activeOrder) {
      const orderItems = activeOrder.items
        .map((it: any) => `${it.menuItemName} (Quantity: ${it.quantity}, Price: ৳${it.price})`)
        .join(", ");
      orderContext = `The customer has an order currently in the system:
- Order Number: ${activeOrder.orderNumber}
- Current Status: ${activeOrder.status}
- Items ordered: ${orderItems}
- Order Total: ৳${activeOrder.total.toFixed(2)}
- Special Instructions: ${activeOrder.specialInstructions || "None"}
- Ordered at: ${activeOrder.createdAt.toISOString()}`;
    }

    const systemInstruction = `
You are CampusBite AI Assistant, a friendly and helpful smart cafeteria chatbot for a university campus.
The customer is currently sitting at Table ${tableNumber || "unknown"}.
All prices are in Bangladeshi Taka (৳).

${orderContext}

Here is the current live cafeteria menu:
${menuContext}

Guidelines:
1. Provide accurate recommendations based ONLY on the menu list above. If they ask for food items not on the menu, politely tell them we don't serve it.
2. If an item is OUT_OF_STOCK, state that it's currently unavailable and recommend in-stock alternatives.
3. Be concise and friendly. Campus users view this chatbot on mobile screens, so keep responses relatively brief (2-4 sentences max per turn).
4. Do not make up items.
5. If the user asks for recommendations, ask what they are in the mood for (e.g. savory, sweet, drinks) or recommend popular items.
6. Support multilingual queries. If they chat in a language other than English, reply in that language.
7. When recommending food, dynamically suggest in-stock items based on the user's specific request or query. If they ask for general recommendations, suggest a diverse set of 2-3 in-stock items from different categories (e.g. a main course and a drink/dessert). Explain why you recommended them based on their description. DO NOT force Khichuri in every recommendation unless they explicitly ask for it or it matches their mood/request.
8. If the user asks about their order status, progress, or what they ordered, check the active order details provided in the context and answer accurately. Do NOT suggest Khichuri or recommend items when they are asking about order status, unless they explicitly ask for recommendations too. Be precise about their order status (e.g. RECEIVED, PREPARING, READY, COMPLETED, CANCELLED).
9. MEAL TIMES CLASSIFICATION: When the user asks about available items for a specific meal time (e.g. breakfast, morning, lunch, dinner, afternoon, night, snack, evening):
   - You MUST analyze the entire live menu and classify the items yourself based on their characteristics, categories, descriptions, or typical dining habits:
     * Breakfast / Morning: Suggest beverages (like tea, Masala Chai, coffee, Cold Coffee) and any lightweight breakfast-appropriate items.
     * Lunch / Dinner / Main Meals: Suggest main courses (like Chicken Biryani, Khichuri, Crispy Chicken Burger) or heavy, filling dishes.
     * Snacks / Appetizers / Evening: Suggest appetizers (like Loaded Cheesy Fries, Fried Chicken) and desserts.
   - Do NOT say that we do not serve breakfast, lunch, or dinner.
   - List ALL applicable items that are currently IN_STOCK. Do not list OUT_OF_STOCK items.
   - For each recommended item, explain briefly why it is appropriate for that meal time.
10. TOOL USE: You have the 'placeOrder' tool. Whenever the customer explicitly tells you to order, buy, or purchase one or more items (e.g., "I want to order tea", "please order a burger", "buy 2 fries"), you MUST call the 'placeOrder' tool with the resolved database item IDs and quantities.
    - If the user uses a generic term (e.g. "tea" or "chai" for "Masala Chai", "coffee" for "Cold Coffee", "burger" for "Crispy Chicken Burger", "fries" for "Loaded Cheesy Fries", "brownie" for "Chocolate Fudge Brownie"), map it to the closest matching in-stock menu item ID from the live menu context.
`;

    const apiKey = process.env.GEMINI_API_KEY;

    // Tool Declarations for Gemini
    const placeOrderDeclaration: FunctionDeclaration = {
      name: "placeOrder",
      description: "Place an order for menu items directly. Call this when the user explicitly requests to order, buy, or purchase one or more items (e.g. 'I want to order tea' or 'please order 1 biryani').",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            description: "The list of items to order.",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                itemId: { type: SchemaType.STRING, description: "The database ID of the menu item (e.g. item-khichuri)." },
                quantity: { type: SchemaType.INTEGER, description: "The quantity of this item to order. Default is 1 if not specified." }
              },
              required: ["itemId", "quantity"]
            }
          },
          specialInstructions: { type: SchemaType.STRING, description: "Any special cooking instructions or requests (e.g., no sugar, extra spicy)." }
        },
        required: ["items"]
      }
    };

    const processRefundDeclaration: FunctionDeclaration = {
      name: "processRefund",
      description: "Process a refund for a specific order. Call this when the customer requests a refund for a valid reason (e.g. food arrived extremely late, wrong food, food didn't arrive, or quality issue). The AI can refund up to ৳500 directly.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          orderId: { type: SchemaType.STRING, description: "The database ID of the order or the Order Number (e.g. CB-1234)." },
          amount: { type: SchemaType.NUMBER, description: "The amount to refund. Must not exceed the order total." },
          reason: { type: SchemaType.STRING, description: "The detailed reason for the refund." }
        },
        required: ["orderId", "amount", "reason"]
      }
    };

    const escalateToHumanDeclaration: FunctionDeclaration = {
      name: "escalateToHuman",
      description: "Escalate the order to a human support manager for manual review. Call this when a refund is requested but the amount exceeds ৳500, when the user explicitly asks to talk to a human/manager, or when the refund reason requires manager approval.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          orderId: { type: SchemaType.STRING, description: "The database ID of the order or the Order Number (e.g. CB-1234)." },
          reason: { type: SchemaType.STRING, description: "The reason for escalating to human review." }
        },
        required: ["orderId", "reason"]
      }
    };

    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey.trim() === "") {
      const localRes = generateLocalAIResponse(message, menuItems, activeOrder, tableNumber);
      let responseText = localRes.text;
      if (localRes.recommendIds.length > 0 && !localRes.shouldPlaceOrder) {
        responseText += ` [RECOMMEND: ${localRes.recommendIds.join(", ")}]`;
      }
      
      // Handle local fallback ordering
      if (localRes.shouldPlaceOrder && localRes.recommendIds.length > 0) {
        const orderItems = [];
        for (const itemId of localRes.recommendIds) {
          const item = menuItems.find(m => m.id === itemId);
          if (item && item.status === "IN_STOCK") {
            orderItems.push({
              menuItemId: item.id,
              menuItemName: item.name,
              price: item.price,
              quantity: 1
            });
          }
        }
        if (orderItems.length > 0) {
          const newOrder = await dbService.createOrder({
            tableNumber: tableNumber,
            customerEmail: session?.email || null,
            customerPhone: session?.phone || null,
            customerName: session?.name || "Table " + tableNumber,
            specialInstructions: null,
            items: orderItems,
          });
          responseText = `🤖 [AI Chef] I've placed your order directly! Your order number is **${newOrder.orderNumber}** containing: ${orderItems.map(i => `${i.menuItemName} (x${i.quantity})`).join(", ")}. It has been sent directly to the kitchen!`;
          await dbService.createChatMessage(sessionId, "model", responseText);
          return NextResponse.json({ text: responseText, orderPlaced: true, order: newOrder, isMock: true });
        }
      }

      await dbService.createChatMessage(sessionId, "model", responseText);
      return NextResponse.json({ text: responseText, isMock: true });
    }

    // Initialize Gemini API (using stable gemini-2.5-flash)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
      tools: [{ functionDeclarations: [placeOrderDeclaration, processRefundDeclaration, escalateToHumanDeclaration] }],
    });

    // Retrieve full chat history
    const history = await dbService.getChatMessages(sessionId);

    // Limit history to the last 8 messages (4 turns) to stay within free tier rate limits (TPM)
    const recentHistory = history.length > 9 ? history.slice(-9, -1) : history.slice(0, -1);

    // Map database history to Gemini's chat content structure
    const contents = recentHistory.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Start chat session with history
    const chat = model.startChat({
      history: contents,
    });

    // Send message and get response
    const result = await chat.sendMessage(message);
    
    // Check if the response requested a function call
    const functionCalls = result.response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === "placeOrder") {
        const args: any = call.args;
        const orderItems = [];
        for (const orderItem of args.items) {
          const item = menuItems.find(m => m.id === orderItem.itemId);
          if (item && item.status === "IN_STOCK") {
            orderItems.push({
              menuItemId: item.id,
              menuItemName: item.name,
              price: item.price,
              quantity: orderItem.quantity || 1
            });
          }
        }
        
        if (orderItems.length > 0) {
          const newOrder = await dbService.createOrder({
            tableNumber: tableNumber,
            customerEmail: session?.email || null,
            customerPhone: session?.phone || null,
            customerName: session?.name || "Table " + tableNumber,
            specialInstructions: args.specialInstructions || null,
            items: orderItems,
          });
          
          const confirmText = `🤖 [AI Chef] I've placed your order directly! Your order number is **${newOrder.orderNumber}** containing: ${orderItems.map(i => `${i.menuItemName} (x${i.quantity})`).join(", ")}. It has been sent directly to the kitchen!`;
          await dbService.createChatMessage(sessionId, "model", confirmText);
          
          return NextResponse.json({
            text: confirmText,
            orderPlaced: true,
            order: newOrder
          });
        }
      }
      else if (call.name === "processRefund") {
        const args: any = call.args;
        const refundAmount = Number(args.amount);
        const orderIdentifier = args.orderId;
        const reason = args.reason;

        const orders = await dbService.getOrders();
        const targetOrder = orders.find(o => o.id === orderIdentifier || o.orderNumber === orderIdentifier || o.orderNumber.replace("-", "") === orderIdentifier.replace("-", ""));

        if (!targetOrder) {
          const failText = `🤖 [AI Chef] I'm sorry, I couldn't find order ${orderIdentifier} in the system. Please verify the order number.`;
          await dbService.createChatMessage(sessionId, "model", failText);
          return NextResponse.json({ text: failText });
        }

        if (refundAmount > 500) {
          const escalatedOrder = await dbService.updateOrder(targetOrder.id, {
            refundStatus: "ESCALATED",
            refundReason: `${reason} (Auto-escalated: Refund of ৳${refundAmount} exceeds AI limit of ৳500)`
          });
          const escText = `🤖 [AI Chef] Your refund request for **৳${refundAmount}** exceeds my direct refund authorization limit of ৳500. I have automatically escalated Order **${targetOrder.orderNumber}** to a human manager for manual review.`;
          await dbService.createChatMessage(sessionId, "model", escText);
          return NextResponse.json({
            text: escText,
            orderUpdated: true,
            order: escalatedOrder
          });
        }

        const updatedOrder = await dbService.updateOrder(targetOrder.id, {
          refundStatus: "REFUNDED",
          refundAmount: refundAmount,
          refundReason: reason
        });

        const confirmText = `🤖 [AI Chef] I have successfully processed a refund of **৳${refundAmount}** for Order **${targetOrder.orderNumber}**. Reason: ${reason}. The amount will be credited back to your account.`;
        await dbService.createChatMessage(sessionId, "model", confirmText);
        return NextResponse.json({
          text: confirmText,
          orderUpdated: true,
          order: updatedOrder
        });
      }
      else if (call.name === "escalateToHuman") {
        const args: any = call.args;
        const orderIdentifier = args.orderId;
        const reason = args.reason;

        const orders = await dbService.getOrders();
        const targetOrder = orders.find(o => o.id === orderIdentifier || o.orderNumber === orderIdentifier || o.orderNumber.replace("-", "") === orderIdentifier.replace("-", ""));

        if (!targetOrder) {
          const failText = `🤖 [AI Chef] I'm sorry, I couldn't find order ${orderIdentifier} in the system.`;
          await dbService.createChatMessage(sessionId, "model", failText);
          return NextResponse.json({ text: failText });
        }

        const escalatedOrder = await dbService.updateOrder(targetOrder.id, {
          refundStatus: "ESCALATED",
          refundReason: reason
        });

        const confirmText = `🤖 [AI Chef] I have successfully escalated Order **${targetOrder.orderNumber}** to a human support manager. Reason: ${reason}. A manager will review your request shortly.`;
        await dbService.createChatMessage(sessionId, "model", confirmText);
        return NextResponse.json({
          text: confirmText,
          orderUpdated: true,
          order: escalatedOrder
        });
      }
    }

    const responseText = result.response.text();

    // Save model response to database
    await dbService.createChatMessage(sessionId, "model", responseText);

    return NextResponse.json({ text: responseText });
  } catch (error: any) {
    console.error("Gemini API Error, falling back to local assistant:", error);
    
    const localRes = generateLocalAIResponse(message, menuItems, activeOrder, tableNumber);
    let responseText = localRes.text;
    if (localRes.recommendIds.length > 0 && !localRes.shouldPlaceOrder && !localRes.shouldRefundOrder && !localRes.shouldEscalateOrder) {
      responseText += ` [RECOMMEND: ${localRes.recommendIds.join(", ")}]`;
    }

    if (localRes.shouldRefundOrder && activeOrder) {
      const updatedOrder = await dbService.updateOrder(activeOrder.id, {
        refundStatus: "REFUNDED",
        refundAmount: localRes.refundAmount || activeOrder.total,
        refundReason: localRes.refundReason || "Customer requested refund"
      });
      try {
        await dbService.createChatMessage(sessionId, "model", responseText);
      } catch (dbErr) {
        console.error("Failed to write fallback message to db", dbErr);
      }
      return NextResponse.json({ text: responseText, orderUpdated: true, order: updatedOrder, isMock: true });
    }

    if (localRes.shouldEscalateOrder && activeOrder) {
      const updatedOrder = await dbService.updateOrder(activeOrder.id, {
        refundStatus: "ESCALATED",
        refundReason: localRes.refundReason || "Customer requested human review"
      });
      try {
        await dbService.createChatMessage(sessionId, "model", responseText);
      } catch (dbErr) {
        console.error("Failed to write fallback message to db", dbErr);
      }
      return NextResponse.json({ text: responseText, orderUpdated: true, order: updatedOrder, isMock: true });
    }
    
    if (localRes.shouldPlaceOrder && localRes.recommendIds.length > 0) {
      const orderItems = [];
      for (const itemId of localRes.recommendIds) {
        const item = menuItems.find(m => m.id === itemId);
        if (item && item.status === "IN_STOCK") {
          orderItems.push({
            menuItemId: item.id,
            menuItemName: item.name,
            price: item.price,
            quantity: 1
          });
        }
      }
      if (orderItems.length > 0) {
        const newOrder = await dbService.createOrder({
          tableNumber: tableNumber,
          customerEmail: session?.email || null,
          customerPhone: session?.phone || null,
          customerName: session?.name || "Table " + tableNumber,
          specialInstructions: null,
          items: orderItems,
        });
        responseText = `🤖 [AI Chef] I've placed your order directly! Your order number is **${newOrder.orderNumber}** containing: ${orderItems.map(i => `${i.menuItemName} (x${i.quantity})`).join(", ")}. It has been sent directly to the kitchen!`;
        try {
          await dbService.createChatMessage(sessionId, "model", responseText);
        } catch (dbErr) {
          console.error("Failed to write fallback message to db", dbErr);
        }
        return NextResponse.json({ text: responseText, orderPlaced: true, order: newOrder, isMock: true });
      }
    }

    try {
      await dbService.createChatMessage(sessionId, "model", responseText);
    } catch (dbErr) {
      console.error("Failed to write fallback message to db", dbErr);
    }

    return NextResponse.json({ text: responseText, isMock: true });
  }
}

