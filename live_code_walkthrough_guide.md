# CampusBite: Live Code Walkthrough & Interview Guide

This guide is structured specifically for a **live screenshare code walkthrough**. It maps out the exact file paths, function calls, database interactions, and security gates for the **Order Logic** and **Refund/Cancellation Logic** so you can talk through the codebase step-by-step during your interview.

---

## 🗺️ Codebase Map & Entry Points
Keep these file paths ready in your editor during the walkthrough:
1.  **Frontend Views**:
    *   Customer Portal: [TableOrderingView.tsx](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/components/TableOrderingView.tsx)
    *   Admin Dashboard: [AdminDashboardView.tsx](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/components/AdminDashboardView.tsx)
2.  **Server Mutations**:
    *   Server Actions: [actions.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/actions.ts)
3.  **AI Orchestration**:
    *   Chat API Handler: [route.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/api/chat/route.ts)
    *   Gemini Service: [ai.service.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/api/chat/ai.service.ts)
4.  **Security & Data Layer**:
    *   Session Encryption: [session.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/lib/session.ts)
    *   Database Router: [dbService.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/lib/dbService.ts)

---

## 🛒 Section 1: Order Logic Walkthrough (Step-by-Step)

Explain this flow as a **"Client-Server Transaction Pipeline with Inventory Guardrails."**

```
Client UI Cart (TableOrderingView.tsx)
       │ (Sends items list, table number, and notes)
       ▼
Server Action (actions.ts: createOrderAction)
       │ 1. Check item stocks
       │ 2. Check wallet balance
       │ 3. Deduct balance (updateUserBalance)
       │ 4. Decrement stock (updateMenuItem)
       │ 5. Write order record (createOrder)
       ▼
Real-time Poll (KDS Dashboard View)
```

### 1.1 Client-Side Submission
*   **File**: [TableOrderingView.tsx](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/components/TableOrderingView.tsx)
*   **Function**: `handleCheckout()`
*   **Code Walkthrough**:
    1.  The client manages local state for selected items: `const [cart, setCart] = useState<Record<string, number>>({})`.
    2.  When clicking checkout, it formats the payload:
        ```typescript
        const orderItems = Object.entries(cart).map(([itemId, qty]) => {
          const item = menuItems.find(m => m.id === itemId);
          return { menuItemId: itemId, menuItemName: item.name, price: item.price, quantity: qty };
        });
        ```
    3.  It calls the server action `createOrderAction(...)` with the item list, table number, and special instructions.
    4.  If successful, it clears the cart, shows a success toast, and triggers `router.refresh()` to update the wallet balance in the header.

### 1.2 Server Action execution (The Core Core Gates)
*   **File**: [actions.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/actions.ts)
*   **Function**: `createOrderAction()`
*   **Code Walkthrough**:
    1.  **Authentication Guard**: Reads user session using `getSession()`. If missing, aborts.
    2.  **Stock Guard**: Loops over each item and fetches live stock from the database:
        ```typescript
        const dbItem = await dbService.getMenuItem(oItem.menuItemId);
        if (dbItem.stock < oItem.quantity) {
          return { success: false, error: `Sorry, ${oItem.menuItemName} is out of stock. Only ${dbItem.stock} left.` };
        }
        ```
    3.  **Wallet Balance Guard**: Calculates order total. Fetches customer's wallet balance:
        ```typescript
        if (user.balance < total) {
          return { success: false, error: "Insufficient wallet balance..." };
        }
        ```
    4.  **Balance Deduction**: Subtracts the total from user's balance and saves it.
    5.  **Stock Decrement**: Subtracts the quantity from each menu item's stock in the database. If stock hits `0`, sets the status to `"OUT_OF_STOCK"`.
    6.  **Create Order**: Calls `dbService.createOrder(...)` to write the order.

### 1.3 AI Chat Ordering Flow
*   **Files**: [route.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/api/chat/route.ts) & [ai.service.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/api/chat/ai.service.ts)
*   **Code Walkthrough**:
    1.  The user sends a chat message. The API route passes the live menu items list (with remaining stock) and wallet balance as context strings in the system instructions.
    2.  If the user says: *"I want to order Masala Chai,"* Gemini Pro parses the request and matches item parameters.
    3.  **Safety Guard**: If Gemini detects that the total price exceeds the balance, or if stock is insufficient, it refuses to place the order and instead recommends topping up or choosing alternatives.
    4.  If checks pass, Gemini returns a structured JSON payload with `intent: "PLACE_ORDER"` and extracted items.
    5.  The API route controller intercepts the `PLACE_ORDER` intent and calls the exact same `createOrderAction` server action to execute balance deductions and stock updates.

---

## 💸 Section 2: Refund & Cancellation Logic Walkthrough

Explain this as a **"State-Transition Validation Engine (Defense-in-Depth)"**.

### 2.1 Customer Self-Service Cancellation (The 9-Rule Gates)
*   **File**: [actions.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/actions.ts)
*   **Function**: `cancelOrderCustomerAction()`
*   **Code Walkthrough**:
    When a customer clicks "Cancel" in their history panel, this server action runs 9 safety checks:
    ```typescript
    // 1. Session verification
    const session = await getSession();
    if (!session) return { error: "Authentication required." };

    // 2. Input sanitisation (prevents prompt-injection/XSS log corruption)
    const safeReason = String(reason).replace(/<[^>]*>/g, "").replace(/[{}\[\]]/g, "").trim().slice(0, 300);

    // 3. Database fetch (never trust client-provided order data)
    const order = await dbService.getOrder(orderId);
    if (!order) return { error: "Order not found." };

    // 4. Ownership verification (Prevents IDOR/unauthorized cancellations)
    const isOwner = (session.email && order.customerEmail === session.email) ||
                    (session.phone && order.customerPhone === session.phone);
    if (!isOwner && session.role !== "ADMIN") return { error: "Access Denied." };

    // 5. Terminal State Guard
    if (["CANCELLED", "COMPLETED"].includes(order.status)) {
      return { error: "Order is already in a terminal state." };
    }

    // 6. Double-Refund Guard (Critical Security Fix)
    if (order.refundStatus && ["REFUNDED", "REFUND_DENIED"].includes(order.refundStatus)) {
      return { error: "A refund has already been resolved for this order." };
    }

    // 7. Kitchen Preparation Guard
    if (order.status !== "RECEIVED") {
      return { error: "Kitchen has already started cooking. Cannot cancel." };
    }

    // 8. Refund Value verification
    if (!order.total || order.total <= 0) return { error: "Invalid total." };
    ```
    Once all checks pass:
    - Wallet balance is credited back: `balance + order.total`
    - Items stock is restored: `stock + item.quantity`
    - Order status is set to `CANCELLED` and `refundStatus` is marked `REFUNDED` dynamically.

### 2.2 AI-Initiated Refund Requests
*   **File**: [route.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/api/chat/route.ts)
*   **Intent**: `REFUND_REQUEST`
*   **Code Walkthrough**:
    1.  If the customer tells the chatbot: *"Cancel my order,"* Gemini classifies the request as `REFUND_REQUEST`.
    2.  The backend route controller queries the database for the active order.
    3.  **If the status is `RECEIVED`**: It automatically invokes `cancelOrderCustomerAction(...)` to refund their balance and restore stock.
    4.  **If the status is `PREPARING` or `READY`**: It flags the order as escalated: `refundStatus = "ESCALATED"` and notifies the customer: *"The kitchen has started cooking, so I've escalated your refund request to a manager."*

### 2.3 Admin Manual Refund Approval
*   **File**: [actions.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/app/actions.ts)
*   **Function**: `resolveEscalationAction()`
*   **Code Walkthrough**:
    1.  Escalated refund tickets are listed on the Admin Dashboard under the **Refunds** tab.
    2.  When the Admin clicks "Approve", the server action is invoked:
        ```typescript
        export async function resolveEscalationAction(orderId: string, resolution: "REFUNDED" | "REFUND_DENIED") {
          // 1. Role verification: rejects if session.role !== "ADMIN"
          // 2. State checks: rejects if already refunded
          // 3. Credit wallet: credits o.total to the customer's balance
          // 4. Update order: refundStatus = resolution
        }
        ```

---

## 🔒 Section 3: High-Value Security Architectural Points

Be sure to highlight these security details during your interview walkthrough:

1.  **Dual-Engine Architecture (Sandbox Resiliency)**:
    Point to [dbService.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/lib/dbService.ts). Explain how the codebase dynamically falls back to an offline file-system JSON database engine (`mockDb.ts`) if the live MongoDB cloud instance is unavailable or credentials are missing. This ensures the app is fully functional in development and staging environments.
2.  **AES-256-CBC Session Encryption**:
    Show [session.ts](file:///C:/Users/Shahriar/Desktop/ai-cafeteria-v2/src/lib/session.ts). Explain how cookie tampering (e.g. changing `"role": "CUSTOMER"` to `"role": "ADMIN"`) is mathematically blocked using an encrypted block cipher initialized with a unique vector per session write.
3.  **Case-Insensitive Prisma regex Crash Fix**:
    Explain that a case-insensitive search (`mode: "insensitive"`) on phone numbers containing the `+` character causes MongoDB/Prisma to crash because the `+` is treated as a regex quantifier. You resolved this by checking if the input is an email before applying the case-insensitive flag. Phone numbers are matched exactly.
4.  **Separation of AI Routing**:
    Highlight that the AI engine only extracts parameters and classifies intents. It never makes direct database mutations. This architecture prevents prompt injection exploits from bypassing business logic rules.

---

## 💬 Section 4: Practical Details & compensation Prep

### 4.1 Questions to Ask the Interview Team
Show that you are thinking about engineering quality and scalability:
1.  **AI Scalability**: *"How are you currently handling LLM rate limits and token optimization as customer volume grows? Have you considered semantic caching for common menu queries?"*
2.  **Database Strategy**: *"For concurrent order spikes in high-volume dining environments, how do you handle transactional safety? Do you use pessimistic locking or distributed locking models?"*
3.  **Local Development Resiliency**: *"I implemented a dual-engine fallback in CampusBite for mock environments. How do you handle local database staging and mock contexts for developer onboarding?"*

### 4.2 compensation Positioning
As a Senior AI Agent Engineer, focus on the value you deliver:
*   *"I align my engineering around high availability, security guardrails, and conversational design. The architecture I build prevents prompt injections, maintains transactional security, and ensures offline fallback resilience."*
*   Research regional standard compensation rates for Senior Engineers to prepare for the discussion.
