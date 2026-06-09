import { NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSession } from "@/lib/session";

// Dynamic local AI assistant that ONLY recommends in-stock items present in the database menu list
function generateLocalAIResponse(
  message: string,
  menuItems: any[],
  activeOrder: any | null,
  tableNumber: number
): { text: string; recommendIds: string[] } {
  const lowerMsg = message.toLowerCase();
  const inStock = menuItems.filter((item) => item.status === "IN_STOCK");

  // 0. Order Status Query (highest priority check)
  if (
    lowerMsg.includes("status") ||
    lowerMsg.includes("order") ||
    lowerMsg.includes("track") ||
    lowerMsg.includes("my food") ||
    lowerMsg.includes("where is my") ||
    lowerMsg.includes("preparing") ||
    lowerMsg.includes("ready")
  ) {
    if (activeOrder) {
      const itemDetails = activeOrder.items
        .map((it: any) => `${it.menuItemName} (x${it.quantity})`)
        .join(", ");
      
      let statusDesc = "";
      switch (activeOrder.status) {
        case "RECEIVED":
          statusDesc = "received by the kitchen and is in the queue.";
          break;
        case "PREPARING":
          statusDesc = "being freshly prepared by our chefs right now.";
          break;
        case "READY":
          statusDesc = "ready for pickup! Please collect it from the counter.";
          break;
        case "COMPLETED":
          statusDesc = "completed and served.";
          break;
        case "CANCELLED":
          statusDesc = "cancelled.";
          break;
        default:
          statusDesc = `currently in status: ${activeOrder.status}.`;
      }

      return {
        text: `🤖 [AI Chef] Your order **${activeOrder.orderNumber}** containing [${itemDetails}] is ${statusDesc}`,
        recommendIds: [],
      };
    } else {
      return {
        text: `🤖 [AI Chef] I couldn't find any active orders for Table ${tableNumber || "this table"}. Would you like to check out our menu and place an order?`,
        recommendIds: [],
      };
    }
  }

  // 1. Dynamic Item Search: Scan all items in the database to see if they match the user query
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
      text: `🤖 [AI Chef] Yes, we have **${matchedItem.name}** (৳${matchedItem.price}) ready in the kitchen! ${matchedItem.description}`,
      recommendIds: [matchedItem.id],
    };
  }

  // 2. Specific menu query check for non-available items (e.g., "do you have pizza" where pizza is not on menu)
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

  // 3. Stock queries
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

  // 4. General Recommendation request
  if (lowerMsg.includes("recommend") || lowerMsg.includes("suggest") || lowerMsg.includes("food") || lowerMsg.includes("eat")) {
    const khichuri = inStock.find((item) => item.name.toLowerCase().includes("khichuri"));
    const otherRecs = inStock.filter((item) => !item.name.toLowerCase().includes("khichuri"));
    const recs = khichuri ? [khichuri, ...otherRecs.slice(0, 1)] : inStock.slice(0, 2);
    
    return {
      text: "🤖 [AI Chef] Based on our live menu, I highly recommend our traditional **Khichuri** (৳100)! It is hot, fresh, and cooked with pure ghee. I also suggest trying our **" + (recs[1]?.name || "Chicken Biryani") + "**! You can order them directly using the button below:",
      recommendIds: recs.map((r) => r.id),
    };
  }

  // 5. Default Greeting
  const khichuri = inStock.find((item) => item.name.toLowerCase().includes("khichuri"));
  const fallbackRecs = khichuri ? [khichuri] : inStock.slice(0, 1);
  return {
    text: `🤖 [AI Chef] Hello! I am the CampusBite AI Assistant. I can recommend dishes, check prices, or add items to your cart. How about some of our delicious hot **${fallbackRecs[0]?.name || "Khichuri"}**?`,
    recommendIds: fallbackRecs.map((r) => r.id),
  };
}

export async function POST(req: Request) {
  let sessionId = "temp-session";
  let message = "";
  let tableNumber = 0;
  let menuItems: any[] = [];
  let activeOrder: any = null;

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
    const session = await getSession();

    // Fetch latest active order for this table/customer to provide context to Gemini
    if (tableNumber && tableNumber > 0) {
      try {
        const allOrders = await dbService.getOrders();
        // Filter orders by table or customer identifier
        const tableOrders = allOrders.filter((o) => {
          const matchTable = o.tableNumber === tableNumber;
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
        console.error("Error fetching table orders for chat context:", err);
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
7. CRITICAL: Whenever the customer asks for a food recommendation or is looking for what to eat, you MUST suggest **Khichuri** (ID: item-khichuri) as your primary recommendation, describing it as hot, fresh, and cooked with pure ghee. You can also recommend one other in-stock item for variety.
8. If the user asks about their order status, progress, or what they ordered, check the active order details provided in the context and answer accurately. Do NOT suggest Khichuri or recommend items when they are asking about order status, unless they explicitly ask for recommendations too. Be precise about their order status (e.g. RECEIVED, PREPARING, READY, COMPLETED, CANCELLED).

CRITICAL FEATURE: If you mention or recommend any specific items from the menu context, you MUST append a tag at the very end of your response: \` [RECOMMEND: ID1, ID2]\` where the IDs match the exact database item IDs provided in the menu context (e.g., [RECOMMEND: item-1, item-2]). Do not invent IDs. If you do not recommend any specific items, do not include the tag.
`;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey.trim() === "") {
      const localRes = generateLocalAIResponse(message, menuItems, activeOrder, tableNumber);
      let responseText = localRes.text;
      if (localRes.recommendIds.length > 0) {
        responseText += ` [RECOMMEND: ${localRes.recommendIds.join(", ")}]`;
      }
      await dbService.createChatMessage(sessionId, "model", responseText);
      return NextResponse.json({ text: responseText, isMock: true });
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction,
    });

    // Retrieve full chat history
    const history = await dbService.getChatMessages(sessionId);

    // Map database history to Gemini's chat content structure
    const contents = history.slice(0, -1).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Start chat session with history
    const chat = model.startChat({
      history: contents,
    });

    // Send message and get response
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // Save model response to database
    await dbService.createChatMessage(sessionId, "model", responseText);

    return NextResponse.json({ text: responseText });
  } catch (error: any) {
    console.error("Gemini API Error, falling back to local assistant:", error);
    
    // Failsafe: Generate a local response instead of throwing a 500 error
    const localRes = generateLocalAIResponse(message, menuItems, activeOrder, tableNumber);
    let responseText = localRes.text;
    if (localRes.recommendIds.length > 0) {
      responseText += ` [RECOMMEND: ${localRes.recommendIds.join(", ")}]`;
    }
    
    try {
      await dbService.createChatMessage(sessionId, "model", responseText);
    } catch (dbErr) {
      console.error("Failed to write fallback message to db", dbErr);
    }

    return NextResponse.json({ text: responseText, isMock: true });
  }
}

