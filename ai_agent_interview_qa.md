# CampusBite: AI Agent Technical Interview Q&A Masterclass

> **Last Updated**: July 2026 — updated with all new features: AI-driven cancellations, double-refund prevention, stock awareness, prompt injection mitigation, and 9-rule server validation.

This guide provides **42 deep-dive technical questions and answers** focusing on the AI Agent architecture, LLM configurations, prompt engineering, security boundaries, integration pipelines, and new features added as of July 2026.

---

## Category Index
- Category A: AI Agent Architecture & System Flow (Q1–Q7)
- Category B: Gemini SDK, Structured JSON Schemas & Type Safety (Q8–Q13)
- Category C: Intent Classification & Routing Logic (Q14–Q20)
- Category D: Prompt Engineering & Context Assembly (Q21–Q26)
- Category E: Security Engineering, Prompt Injection & Guardrails (Q27–Q34)
- Category F: API Resiliency, Fallbacks & Rate Limits (Q35–Q38)
- Category G: New Features — Cancellations, Stock & Double-Refund Prevention (Q39–Q42)

---

## Category A: AI Agent Architecture & System Flow

### Q1: Describe the end-to-end data flow when a user sends a chat message.
> **Answer**:
> 1. Client POST to `/api/chat` with message, tableNumber, and sessionId.
> 2. API route records the message in the DB, fetches live menu items, active orders, and the user's wallet balance.
> 3. Passes everything to `AIService.parseUserIntent()`.
> 4. AIService sends to Gemini Pro with a strict JSON schema. If API fails, falls back to regex classifier.
> 5. Validates confidence score (>= 0.6, else escalate).
> 6. Routes to the intent handler switch block — runs DB operations, forms the reply.
> 7. Reply saved to DB chat logs and returned to the client.

### Q2: Why is the AI designed as a "thin classification agent" rather than a fully autonomous agent?
> **Answer**:
> Making an LLM fully autonomous with direct DB write access introduces extreme risks — DB corruption, unauthorized state changes, prompt injection exploitation. The CampusBite AI Chef is a **Classification & Parameter Extraction Agent** only. It translates natural language into structured parameters, then delegates execution to server-controlled Server Actions with their own authorization checks. This enforces strict separation of concerns.

### Q3: How is chat conversation state maintained across requests?
> **Answer**:
> HTTP is stateless. Every chat message is persisted in the DB with a unique `sessionId`. Before each LLM call, the controller queries all previous messages for that `sessionId`, ordered chronologically, and formats them as `[{ role: "user", parts: [...] }, { role: "model", parts: [...] }]` for Gemini's conversation history parameter.

### Q4: How does instant ordering via chat work — skipping the traditional cart flow?
> **Answer**:
> 1. Intent is classified as `PLACE_ORDER` with the extracted items array.
> 2. The chat controller route receives this intent.
> 3. Rather than writing to the database directly, it imports and calls the `createOrderAction` Server Action.
> 4. The Server Action validates stock availability, wallet balance, deducts the balance, decrements the item stocks, and writes the order.
> 5. AI replies: "I have placed your order. Order number: CB-XXXX."

### Q5: How do recommended food cards render inside chat bubbles?
> **Answer**:
> 1. System prompt instructs LLM: when suggesting dishes, append `[RECOMMEND: item-id1, item-id2]` to its reply.
> 2. Client parser `parseRecommendIds()` uses regex `/\[RECOMMEND:\s*([^\]]+)\]/` to extract IDs.
> 3. Strips the token from visible text (users never see raw tokens).
> 4. Extracted IDs are mapped against local menu data and rendered as interactive dish cards below the chat bubble.

### Q6: How does the AI know which table to order from?
> **Answer**:
> The table URL (e.g., `/table/4`) contains the table number. The client web page passes this in the POST payload to `/api/chat` on every message. The API controller includes it in the AI context so the LLM knows the dining location.

### Q7: How does the AI handle order cancellations? (NEW — Critical Feature)
> **Answer**:
> 1. User types "Cancel my order" — AI classifies as `REFUND_REQUEST`.
> 2. Controller checks `targetOrder.refundStatus` first — if already set, responds informatively with zero DB action (double-refund blocked).
> 3. If order is `RECEIVED`, calls `cancelOrderCustomerAction()` — a Server Action with 9 server-side validation rules.
> 4. If `PREPARING`+ — escalates to human manager, explains cooking has started.
> 5. If `CANCELLED`/`COMPLETED` — informs user no further action is possible.
> 6. All cases: the Server Action's rules are the final authority — the AI cannot bypass them regardless of what the user says.

---

## Category B: Gemini SDK, Structured JSON Schemas & Type Safety

### Q8: Why use `responseMimeType: "application/json"` instead of free-form text?
> **Answer**:
> Free-form LLM outputs are non-deterministic and prone to syntax variations. An agent replying "I want to order biryani" in prose cannot be reliably parsed by the backend. Setting `responseMimeType: "application/json"` with a defined schema guarantees a parseable structured JSON matching our TypeScript interfaces, preventing runtime crashes.

### Q9: How is type safety maintained between LLM output and the Next.js backend?
> **Answer**:
> We define a TypeScript interface `IntentResponse` matching Gemini's configured schema exactly:
> ```typescript
> interface IntentResponse {
>   intent: "GENERAL_INQUIRY" | "PLACE_ORDER" | "ORDER_STATUS" | "REFUND_REQUEST" | "ACCOUNT_MODIFICATION" | "ESCALATION";
>   confidence: number;
>   extractedData?: { orderId?, tableNumber?, amount?, reason?, items?: Array<{itemId, quantity}>, specialInstructions? };
>   replyDraft: string;
> }
> ```
> Then: `const parsed: IntentResponse = JSON.parse(text)` — TypeScript enforces static type checks on all properties.

### Q10: What happens if Gemini fails to return valid JSON?
> **Answer**:
> `JSON.parse(text)` throws. The `try/catch` block logs the error and triggers the offline fallback regex classifier. The app returns a best-effort response — it never crashes to the user.

### Q11: How does the schema extract multiple items from a single sentence?
> **Answer**:
> The `items` property inside `extractedData` is typed as `SchemaType.ARRAY` with items as `SchemaType.OBJECT` containing `itemId` and `quantity`. This instructs Gemini to scan the user text, identify all requested dishes, match IDs from the menu context, and output them as structured objects:
> `items: [{ itemId: "item-tea", quantity: 2 }, { itemId: "item-burger", quantity: 1 }]`.

### Q12: What is the purpose of the `confidence` property?
> **Answer**:
> It is a self-reported safety gate. We prompt the LLM to score its classification confidence from 0.0 to 1.0. If below 0.6, the backend overrides the classified intent and routes to `ESCALATION` — protecting against acting on uncertain classifications.

### Q13: How are generic item names (like "tea") mapped to specific database IDs?
> **Answer**:
> The full menu with IDs, names, prices, and stock is serialized in the system prompt. The prompt instructs: "Map generic item names to the closest matching in-stock database item ID." Gemini reads the menu, finds "Masala Chai" matches "tea", and inserts `"item-tea"` into the structured output. The backend then verifies the item exists and is in-stock.

---

## Category C: Intent Classification & Routing Logic

### Q14: Explain the 6 intent classifications and their triggers.
> **Answer**:
> 1. `GENERAL_INQUIRY` — Menu questions, prices, dietary info, greetings, recommendations.
> 2. `PLACE_ORDER` — Direct ordering commands ("I want a burger").
> 3. `ORDER_STATUS` — Tracking questions ("Where is my food? Is CB-1002 ready?").
> 4. `REFUND_REQUEST` — Cancellation or refund requests for an active or past order.
> 5. `ACCOUNT_MODIFICATION` — Credential update requests ("change my phone number").
> 6. `ESCALATION` — High frustration, demands for human manager, food safety concerns.

### Q15: How does `ORDER_STATUS` identify the right order?
> **Answer**:
> 1. If user mentions an order number ("Is CB-1002 ready?"), AI extracts `orderId: "CB-1002"`.
> 2. If no number mentioned, `orderId` is empty.
> 3. Controller checks `extractedData.orderId`:
>    - If set → queries DB for that specific order.
>    - If empty → falls back to the user's active table order.

### Q16: Why is `ACCOUNT_MODIFICATION` classified if the agent doesn't handle it?
> **Answer**:
> It is a security isolation pattern. Rather than trying to parse and execute account changes in the chat (vulnerable to social engineering), we classify the intent and route it to a handler that explicitly blocks the request and redirects to the secure Account Settings portal. This ensures no account modification can ever happen through the chat interface.

### Q17: How does `REFUND_REQUEST` handle auto-cancellation vs. manual escalation?
> **Answer**:
> The router first checks the live order status from the DB:
> - `RECEIVED` + no existing refundStatus → auto-cancel via `cancelOrderCustomerAction()` with 9 validation rules → wallet refunded immediately.
> - `RECEIVED` + existing refundStatus → double-refund blocked, informational response.
> - `PREPARING`, `READY` → escalate to human manager, notify cooking has started.
> - `CANCELLED`, `COMPLETED` → terminal state, inform user no action possible.

### Q18: What does the `ESCALATION` handler do in the DB?
> **Answer**:
> Flags the active order with `refundStatus = "ESCALATED"` and the escalation reason. This pushes the order to the Admin Dashboard "Pending Refunds" tab, alerting staff to visit the table. A server log event is written for audit trail.

### Q19: Why is the intent router implemented as a `switch` block in Node.js instead of inside the LLM?
> **Answer**:
> It ensures **deterministic routing**. Running the router in the Next.js backend controller means routing, DB writes, and transactions follow strict server-enforced rules. This prevents the LLM from making unauthorized DB state changes regardless of what the user says.

### Q20: How does the agent handle a request with low confidence?
> **Answer**:
> The confidence gate forces re-classification to `ESCALATION` for any score below 0.6. This means the LLM's intent guess is discarded, the conversation is flagged for human review, and the user is told a manager will assist. This protects against the system acting on confused or manipulated classifications.

---

## Category D: Prompt Engineering & Context Assembly

### Q21: How do you construct the dynamic context payload for the prompt?
> **Answer**:
> In `route.ts`, before the LLM call, three live data streams are compiled:
> - **Menu Context**: In-stock items serialized as "ID: name, price, category, stock". Out-of-stock items excluded.
> - **Order Context**: Active order details — items, totals, statuses, order number.
> - **Wallet Balance**: Customer's current balance — injected as a number so AI can check affordability.

### Q22: Why serialize the menu as text instead of raw JSON?
> **Answer**:
> Raw JSON is token-heavy and contains metadata (timestamps, IDs, internal fields) the model doesn't need. Serializing only the necessary attributes (ID, Name, Price, Stock) reduces token usage, speeds up responses, and produces cleaner prompts the model reads more reliably.

### Q23: How do you manage prompt length / token bloat with long conversations?
> **Answer**:
> We slice the conversation history before sending:
> `const recentHistory = history.length > 9 ? history.slice(-9) : history;`
> Only the last 9 messages are sent — keeping the prompt small while maintaining enough context.

### Q24: How does the AI know a customer's wallet balance is insufficient?
> **Answer**:
> The customer's live balance is fetched from the DB and injected into the system prompt context. The prompt includes instructions: "If the customer's total order cost exceeds their wallet balance (X BDT), refuse the order, state the balance and order total, and direct them to the Recharge Wallet button in their profile." The AI then classifies the intent as `GENERAL_INQUIRY` instead of `PLACE_ORDER`, preventing order creation.

### Q25: Why does the prompt instruct the LLM not to prefix replies with "🤖 [AI Chef]"?
> **Answer**:
> Emojis and bot-prefixes in chat bubbles look cluttered. The client rendering system already adds the AI avatar visually. Removing the prefix keeps chat bubbles clean and matches the minimalist dark design aesthetic.

### Q26: How does stock information in the prompt help the AI assistant?
> **Answer**:
> Stock quantities are included in the menu context string. If a customer asks "Do you have biryani?" the AI can check the context, see Chicken Biryani has 10 pieces left, and respond accurately. If stock is 0, the AI informs the customer it is out of stock and suggests alternatives — preventing the customer from even trying to order it via chat.

---

## Category E: Security Engineering, Prompt Injection & Guardrails

### Q27: What is the "Cookie Spoofing" vulnerability and how did you resolve it?
> **Answer**:
> Previously, session cookies stored plaintext JSON. An attacker could edit the cookie in their browser, changing `"role":"CUSTOMER"` to `"role":"ADMIN"`, gaining full admin access. The fix was **AES-256-CBC** encryption using Node.js's native `crypto` module. Now any tampering corrupts the block cipher and the backend rejects the session.

### Q28: What is IDOR and how did you solve it in this project?
> **Answer**:
> IDOR (Insecure Direct Object Reference) — the order status endpoint returned order details without verifying the requester owns the order. An attacker could enumerate order IDs and read other customers' private order data. The fix: the route verifies the requester is `ADMIN`, `KITCHEN`, or the `CUSTOMER` whose email/phone matches the order before returning any data.

### Q29: How does the project prevent Prompt Injection attacks from executing unauthorized refunds?
> **Answer**:
> Three independent defense layers:
> 1. **Architectural**: AI never writes to DB — only classifies. All DB writes go through Server Actions with explicit checks.
> 2. **Input Sanitisation**: Cancellation reasons stripped of HTML tags, JSON brackets, trimmed, and capped at 300 chars.
> 3. **AI Router Pre-flight**: The `route.ts` router checks `targetOrder.refundStatus` before calling any cancellation — blocks the action if already processed.

### Q30: How do you prevent double-refunds? (NEW — Critical)
> **Answer**:
> Defense-in-depth with three independent layers:
> - **UI**: Cancel button hidden if `order.refundStatus` is set — users can't even click it.
> - **AI Router**: Checks `targetOrder.refundStatus` before any action — returns informational response if set.
> - **Server Action Rule 6**: `if (order.refundStatus && ["REFUNDED","REFUND_DENIED"].includes(order.refundStatus)) return error` — canonical enforcement.
> All three layers are independent. Even if the UI is bypassed (direct API call or prompt injection), the server rejects it.

### Q31: How are cancellation reasons sanitised against injection?
> **Answer**:
> ```typescript
> const safeReason = String(reason)
>   .replace(/<[^>]*>/g, "")      // strip HTML tags (XSS)
>   .replace(/[{}\[\]]/g, "")     // strip JSON-like brackets (AI log injection)
>   .trim()
>   .slice(0, 300);               // hard length cap
> ```
> This ensures even a crafted malicious payload cannot corrupt server logs, influence subsequent AI calls, or carry script content.

### Q32: How does the server action validate order ownership during cancellation?
> **Answer**:
> The server action fetches the session independently (never trusts the client), then verifies:
> ```typescript
> const isOwner = (session.email && order.customerEmail === session.email) ||
>                 (session.phone && order.customerPhone === session.phone);
> if (!isOwner && session.role !== "ADMIN") { return AccessDenied; }
> ```
> A `CANCEL_ACCESS_DENIED` event is logged to the server console for auditing.

### Q33: How does the backend prevent invalid refund amounts (like negative or NaN)?
> **Answer**:
> Rule 8 of the 9-rule validation: `if (!order.total || order.total <= 0 || !isFinite(order.total)) return error`. This prevents edge cases where a corrupted or zero-total order could trigger a pointless DB write or — in a race condition — a negative wallet credit.

### Q34: How does the project handle XSS in chat logs?
> **Answer**:
> Chat messages are never rendered using `dangerouslySetInnerHTML`. The `renderFormattedText()` function parses markdown-like `**bold**` syntax using native text nodes and JSX elements only. Input messages are also saved to the DB as plain strings, not executed as HTML at any point.

---

## Category F: API Resiliency, Fallbacks & Rate Limits

### Q35: How does the offline regex classifier work?
> **Answer**:
> Triggered if the API key is missing, requests fail, or rate limits are exhausted:
> - `refund|cancel` → `REFUND_REQUEST`
> - `status|track|ready|preparing` → `ORDER_STATUS`
> - `order|buy|want` → `PLACE_ORDER`
> - Else → `GENERAL_INQUIRY`
> Maps matched items to DB IDs and returns a structured fallback payload.

### Q36: Why implement exponential backoff for the AI agent?
> **Answer**:
> API services experience transient failures from network congestion or rate limits (HTTP 429). Our `callWithRetry` helper retries up to 3 times with exponentially increasing delays: 1.5s → 3s → 6s. This resolves transient errors without immediately failing the user's request.

### Q37: How does the KDS notify kitchen staff in real-time when an order arrives via AI chat?
> **Answer**:
> The KDS polls `/api/orders` every 7 seconds. When an order is placed via chat, it is written to the DB by `createOrderAction`. On the next poll, the KDS detects the count increase and calls `playNewOrderBeep()`, triggering an audio alert immediately.

### Q38: How did you fix the Prisma crash on phone numbers containing the `+` prefix?
> **Answer**:
> Prisma's `mode: "insensitive"` translates to MongoDB `$regexMatch`. The `+` character at the start of a pattern is a regex quantifier — MongoDB throws a compile error. The fix: check if the identifier contains `@` before applying the insensitive filter. Phone numbers use exact matching with no regex.

---

## Category G: New Features — Cancellations, Stock & Refund Prevention

### Q39: What are the 9 server-side rules for customer order cancellation, and why each?
> **Answer**:
>
> | # | Rule | Why |
> |---|---|---|
> | 1 | Session must exist | No unauthenticated cancellations |
> | 2 | Reason sanitised | Prompt injection / XSS prevention |
> | 3 | Order exists in DB | Data integrity (never trust client IDs) |
> | 4 | Session user owns the order | IDOR prevention |
> | 5 | Status not CANCELLED/COMPLETED | No cancelling already-terminal orders |
> | 6 | refundStatus not REFUNDED/REFUND_DENIED | **Double-refund prevention** |
> | 7 | Status must be RECEIVED | Kitchen hasn't started yet |
> | 8 | total > 0 and finite | Prevent NaN/negative wallet credits |
> | 9 | All pass → atomic execution | Consistency: cancel + credit wallet + restore stock together |

### Q40: Why is it important that both UI cancellation and AI cancellation use the same Server Action?
> **Answer**:
> **Single source of truth for validation**. If we had two separate paths, we would need to maintain the same 9 validation rules in two places — inevitable drift means security gaps. By routing both paths through `cancelOrderCustomerAction`, we guarantee:
> - No double-refund regardless of which entry point was used.
> - No prompt injection bypass — the AI chatbot path goes through the exact same server checks as the UI button.
> - A single audit log format for all cancellations.

### Q41: How does stock management prevent partial order states?
> **Answer**:
> In `createOrderAction`, the stock check runs **before** the wallet deduction:
> ```
> 1. Check all items have sufficient stock → if any fail, return error IMMEDIATELY (no DB changes)
> 2. Then deduct wallet balance
> 3. Then decrement each item's stock
> 4. Then create the order
> ```
> If Step 1 fails, Steps 2-4 never execute. If the system crashes after Step 2 but before Step 3, the worst case is a wallet deduction with no order — a recoverable situation an admin can manually refund. This ordering is intentional.

### Q42: How does the cancel button UI condition guard against both status and refund simultaneously?
> **Answer**:
> The condition is: `order.status === "RECEIVED" && !order.refundStatus`.
>
> This is stricter than just checking status. An order can be in `RECEIVED` status AND simultaneously have a `refundStatus` of `"REFUNDED"` — exactly the bug that was reported (a refunded order still showing a Cancel button). The `!order.refundStatus` check covers:
> - `"REFUNDED"` (auto-cancelled orders)
> - `"REFUND_DENIED"` (admin-denied refunds)
> - `"ESCALATED"` (pending human review)
>
> None of these states should allow further cancellation attempts. The UI guard provides this UX protection, and the server-side Rule 6 provides the security guarantee — both are necessary.
