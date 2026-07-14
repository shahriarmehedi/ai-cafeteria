# CampusBite: QR Cafeteria & AI Assistant — Technical Reference Guide

This reference guide is designed to help you explain every feature, architectural choice, security guardrail, and data flow of the **CampusBite** application to your course instructor and project interviewers.

---

## 🎯 Executive Summary: Why CampusBite Exists

CampusBite is a **smart, contactless QR-code-based campus dining system** integrated with a **conversational AI Chef Assistant** powered by Gemini AI. 

### Core Problems Solved:
1.  **Queue Elimination**: Students scan a QR code at their table, order immediately, and pay digitally, eliminating queues at cashier counters.
2.  **Kitchen Operational Efficiency**: Real-time kitchen dashboard tickets (KDS) replace paper receipts and provide checklist status tracking.
3.  **Conversational Ordering & Recommendation**: An AI Assistant suggests dishes based on meal times (e.g. breakfast inquiries suggestion) and automatically places orders directly via chat messages without UI clicks.

---

## 🏗️ Technical Stack & Architecture

*   **Frontend**: Next.js 16 (React 19, Client & Server Components), Vanilla CSS (monochrome Zinc design system), Lucide React Icons.
*   **Backend**: Next.js App Router API Routes, Server Actions (`src/app/actions.ts`), and DbService wrapper.
*   **Database**: Dual-engine storage (`src/lib/dbService.ts`):
    *   **MongoDB with Prisma ORM** (Production Database).
    *   **JSON-File Simulator fallback** (`db-mock.json` via `mockDb.ts`). If the MongoDB connection is absent, the system seamlessly boots into a robust local simulation sandbox, displaying a warning banner.
*   **AI Integration**: Google Gen AI SDK (Gemini Pro) utilizing **Structured JSON Schema outputs** to classify intents and extract order/dish data parameters.

---

## 🔄 Core Features: How They Work (Step-by-Step Flow)

### 1. Seating Selector & Table Highlights
*   **How it works**: The homepage displays a list of tables.
    *   Tables with running orders are outlined in **amber** with a `"Running Order"` badge.
    *   The customer's last used table is highlighted in **blue** with a `"Last Used"` label (stored in the session).
*   **Data flow**: Page queries all orders. If an order's status is `RECEIVED`, `PREPARING`, or `READY`, its table number is flagged as active and highlighted.

### 2. Passwordless Login & simulated OTP
*   **Why it is used**: For high-speed, frictionless logins at cafeteria tables without requiring students to remember passwords.
*   **How it works**:
    1.  User enters email or phone.
    2.  The UI intercepts submission and opens a simulated OTP entry screen.
    3.  A simulated OTP code is created. Any 4-digit code is accepted, and once entered, the user is authenticated.
*   **Data flow**: Authenticated sessions are written to cookies using a secure, custom-encrypted cookie handler.

### 3. Unified Bottom Action Bar & Wallet checkout
*   **How it works**:
    *   Users add items to their basket. They can add custom instructions.
    *   **Payment Simulation**: Every customer starts with a mock balance of **৳1,000.00**.
    *   When checkout is submitted, `createOrderAction` checks the database balance:
        *   If balance is sufficient, the total is deducted, and the order is sent to the kitchen.
        *   If balance is insufficient, a visual error toast is shown.

### 4. AI Chef Conversational assistant (Intent Classifier)
*   **The Flow**:
    1.  User types: *"I want to order biryani"* or *"What's for breakfast?"*.
    2.  `api/chat/route.ts` records the user's message and fetches the menu + user session.
    3.  **Classification Engine** (`ai.service.ts`): Passes context to Gemini Pro, requesting a JSON response matching our strict schema:
        ```typescript
        {
          intent: "PLACE_ORDER" | "GENERAL_INQUIRY" | "ORDER_STATUS" | "REFUND_REQUEST" | "ESCALATION" | "ACCOUNT_MODIFICATION",
          confidence: number,
          extractedData?: { items?: Array<{ itemId: string, quantity: number }>, orderId?: string, reason?: string },
          replyDraft: string
        }
        ```
    4.  **Instant Action execution**: If the intent is `PLACE_ORDER`, the controller intercepts the extraction and automatically invokes the checkout database routine. It responds: *"I have placed your order directly! Your order number is CB-XXXX."*
    5.  **Rate-Limit Retry Queue**: Built-in exponential backoff retry queue (`callWithRetry`) catches Gemini API failures or rate limits (429 errors) and retries before falling back.

### 5. Kitchen Dashboard (KDS)
*   **How it works**: Renders active tickets.
    *   **Audio Beep alerts**: Plays an alert tone when new orders are placed.
    *   **Interactive Checklist**: Chefs can check off items on the digital ticket as they prepare them.
    *   **Cancellations Guardrail**: Kitchen staff can only cancel orders in `RECEIVED` status. Cancellation is disabled if cooking has started (`PREPARING`) or if the order is escalated.
    *   **Dedicated Confirmations**: A custom modal handles cancellation clicks instead of browser windows.

### 6. Admin Panel & Human-in-the-Loop Refunds
*   **The Flow**:
    *   If a customer complains/requests a refund in the chat (e.g. *"I want a refund for CB-1002"*), the AI **escalates** it (`refundStatus = "ESCALATED"`).
    *   The KDS is blocked from executing refunds. The request goes to `/admin` -> "Refunds" tab.
    *   The Admin review card displays:
        *   Customer name and email/phone info.
        *   Kitchen cooking status (so admins can check if food was prepared).
        *   Elapsed time since the order was placed (e.g., `35m ago`).
    *   If the admin clicks "Approve", the refund amount is credited back to the customer's wallet balance.

---

## 🔒 Security Architecture (Critical Fixes Implemented)

Explain these points to demonstrate your senior-level understanding of web security:

1.  **AES-256 Encrypted Sessions**:
    *   *Problem*: The session cookie was stored in raw JSON, making it vulnerable to client-side role manipulation (e.g., changing role to `"ADMIN"`).
    *   *Fix*: Implemented native AES-256-CBC encryption in `session.ts`. Cookies are encrypted on write and decrypted on read. Any client-side tampering corrupts the hash, resulting in session invalidation.
2.  **IDOR Protection on Order Lookups**:
    *   *Problem*: Polling `/api/order-status?id=...` allowed anyone to read any order details by guessing order IDs.
    *   *Fix*: Integrated session ownership checking in `/api/order-status/route.ts`. Only the customer who placed the order, admins, or kitchen staff can query order details.
3.  **Strict State mutation boundaries**:
    *   The AI Assistant has **zero write access** to database parameters. The AI can draft replies, but mutations (like checkout and escalations) are handled by backend validation logic.
