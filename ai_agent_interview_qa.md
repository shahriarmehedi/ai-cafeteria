# CampusBite: AI Agent Technical Interview Q&A Masterclass

This guide provides **35 deep-dive technical questions and answers** focusing on the AI Agent architecture, LLM configurations, prompt engineering, security boundaries, and integration pipelines in the **CampusBite** application. Study these scenarios and answers to confidently handle questions from senior architects and AI engineering interviewers.

---

## 📂 Category Index
1. **Category A: AI Agent Architecture & System Flow** (Q1 – Q6)
2. **Category B: Gemini SDK, Structured JSON Schemas, & Type Safety** (Q7 – Q12)
3. **Category C: Intent Classification & Routing Logic** (Q13 – Q18)
4. **Category D: Prompt Engineering & Context Assembly** (Q19 – Q24)
5. **Category E: Security Engineering, Prompt Injection, & Guardrails** (Q25 – Q30)
6. **Category F: API Resiliency, Fallbacks, & Rate Limits** (Q31 – Q35)

---

## 🌐 Category A: AI Agent Architecture & System Flow

### Q1: Can you describe the end-to-end data flow when a user sends a chat message?
> **Answer**: 
> 1. The client browser triggers a POST request to `/api/chat`.
> 2. The API route controller captures the text payload, table number, and session ID, recording the user's message in the database.
> 3. The controller queries live cafeteria menu items and active order data to compile a fresh context payload.
> 4. The controller instantiates the `AIService` class and passes the message, history, menu, active orders, and table number to the `parseUserIntent()` method.
> 5. The AI agent executes a rate-limit retry wrapped cloud API request to Google Gemini Pro using a structured JSON schema configuration.
> 6. The parser receives the JSON, checks the classification confidence score:
>    * If confidence >= 0.6, it executes intent-based backend actions (e.g. creating orders, fetching status, flagging refunds).
>    * If confidence is low, it escalates to human support.
> 7. The final text reply is saved to the chat message logs and returned to the client browser in the response JSON.

### Q2: Why is the AI implementation designed as a "thin classification agent" rather than a fully autonomous agent writing database queries?
> **Answer**: 
> Making an LLM fully autonomous with direct write access to databases introduces extreme security and operational risks (e.g. database corruption, SQL injection, unauthorized state changes). 
> The CampusBite AI Chef is a **Classification & Parameter Extraction Agent**. It translates natural language into structured parameters (like item IDs and quantities) but delegates execution to server-controlled APIs and db wrappers. This enforces a strict **separation of concerns** where the agent handles language parsing, while the backend maintains control over data validation and authorization checks.

### Q3: How is the state of the chat conversation maintained across requests?
> **Answer**: 
> Since HTTP requests are stateless, we persist chat logs in the database.
> * Every chat message is tied to a unique `sessionId` generated on the client.
> * Before sending a request to the LLM, the API controller queries the database for all previous messages matching the current `sessionId`.
> * The conversation logs are ordered chronologically and formatted into a list of messages: `[{ role: "user", parts: [...] }, { role: "model", parts: [...] }]` which is sent to Gemini as conversation history.

### Q4: How does the instant order chat flow skip the traditional "Add to Cart" and checkout button steps?
> **Answer**: 
> 1. When the agent detects the user wants to buy food directly, it classifies the intent as `PLACE_ORDER` and extracts an array of items containing matching database item IDs and quantities.
> 2. The `/api/chat` route controller intercepts the `PLACE_ORDER` intent.
> 3. Rather than returning a message suggesting the user click a button, the controller invokes `dbService.createOrder()` using the extracted parameters.
> 4. It executes a wallet balance deduction, creates the order, and updates the customer's active tracking panel.
> 5. The agent then replies: *"I have placed your order directly! Your order number is CB-XXXX."*

### Q5: How do recommended food cards render inside user chat bubbles?
> **Answer**: 
> 1. In the system instruction prompt, we command the LLM that if it suggests dishes, it must append a special card trigger token to its reply, formatted as: `[RECOMMEND: item-id1, item-id2]`.
> 2. The client chat rendering component runs a parser function `parseRecommendIds()` using regex: `/\[RECOMMEND:\s*([^\]]+)\]/`.
> 3. It strips this bracket token from the text bubble so the raw token is never visible to the user.
> 4. The extracted item IDs are mapped against local menu data, and the UI dynamically renders matching interactive dish cards under the chat bubble.

### Q6: How does the application identify which table the user is ordering from in the chat?
> **Answer**: 
> When the user scans a table QR code, the URL contains the table number (e.g., `/table/4`). 
> The client web page grabs this parameter and forwards it in the request payload to `/api/chat` on every message. The API controller passes this table number directly to the AI agent context, allowing the LLM to know the dining table location (e.g. *"Table 4"*).

---

## 📋 Category B: Gemini SDK, Structured JSON Schemas, & Type Safety

### Q7: Why do we use Gemini's `responseMimeType: "application/json"` config instead of requesting free-form text?
> **Answer**: 
> Free-form text outputs from LLMs are non-deterministic and prone to syntax variations. If an agent replies with *"I want to order biryani"* in conversational text, the backend cannot reliably parse it.
> Setting `responseMimeType` to `"application/json"` alongside a defined JSON schema guarantees that Gemini returns a structured JSON payload that matches our system interfaces, preventing runtime parser errors.

### Q8: How did you implement type safety between the LLM output and the Next.js backend?
> **Answer**: 
> We defined a TypeScript interface `IntentResponse` matching the properties configured in Gemini's schema:
> ```typescript
> export interface IntentResponse {
>   intent: "GENERAL_INQUIRY" | "PLACE_ORDER" | "ORDER_STATUS" | "REFUND_REQUEST" | "ACCOUNT_MODIFICATION" | "ESCALATION";
>   confidence: number;
>   extractedData?: {
>     orderId?: string;
>     tableNumber?: number;
>     amount?: number;
>     reason?: string;
>     items?: Array<{ itemId: string; quantity: number }>;
>     specialInstructions?: string;
>   };
>   replyDraft: string;
> }
> ```
> In `ai.service.ts`, we parse the response string: `const parsed: IntentResponse = JSON.parse(text)`. This allows our IDE and compilers to enforce static type checks on all properties returned by the agent.

### Q9: What happens if Gemini fails to return a JSON matching the requested schema?
> **Answer**: 
> If the API returns a malformed JSON string or is missing required properties, the `JSON.parse(text)` statement fails. The system catches the error inside a `try/catch` block, logs the event, and triggers the offline fallback engine. The offline classifier processes the request using safe regex rules and returns a structured fallback payload, preventing the app from crashing.

### Q10: How does the Gemini schema extract multiple items from a single sentence?
> **Answer**: 
> We defined the `items` property inside `extractedData` as `SchemaType.ARRAY`, with its items configured as `SchemaType.OBJECT` containing `itemId` and `quantity` fields. 
> This instructs the model to loop over the user text, find all requested dishes, match them against the menu IDs, count the requested quantities, and output them as structured objects in the array (e.g. `items: [{ itemId: "item-tea", quantity: 2 }, { itemId: "item-burger", quantity: 1 }]`).

### Q11: What is the purpose of the `confidence` property in the Gemini schema configuration?
> **Answer**: 
> It acts as a safety gate. We prompt the LLM to score its own classification confidence from `0.0` to `1.0`. 
> If the model returns a score below `0.6`, the backend controller overrides the classified intent and routes the query to `"ESCALATION"`. This prevents the system from acting on uncertain classifications.

### Q12: How are item descriptions and prices mapped from natural language to database IDs inside `PLACE_ORDER`?
> **Answer**: 
> We supply the complete in-stock menu context in the system prompt. If a user says *"order tea"*, the LLM checks the menu list, identifies the item named *"Masala Chai"* has the ID `"item-tea"`, and inserts `"item-tea"` into the structured JSON output. The backend then verifies that the item exists and is in-stock before creating the order.

---

## 🔄 Category C: Intent Classification & Routing Logic

### Q13: Explain the 6 intent classifications and their trigger criteria.
> **Answer**:
> 1.  `GENERAL_INQUIRY`: Questions about menu items, prices, dietary specs, greetings, or conversational chit-chat.
> 2.  `PLACE_ORDER`: Direct ordering commands (e.g. *"I want to order a burger"*).
> 3.  `ORDER_STATUS`: Questions about active tracking or what was ordered (e.g. *"Where is my food?"*).
> 4.  `REFUND_REQUEST`: Customer requesting a cancellation with reimbursement for an active or completed order.
> 5.  `ACCOUNT_MODIFICATION`: Queries asking to update personal credentials (e.g. *"change my phone number"*).
> 6.  `ESCALATION`: Expressing high frustration, demanding human managers, or reporting food safety concerns.

### Q14: How does the `ORDER_STATUS` intent handle order identification?
> **Answer**: 
> 1. If the user mentions a specific order number (e.g., *"Is CB-1002 ready?"*), the agent extracts `orderId: "CB-1002"`.
> 2. If no order number is mentioned, `orderId` is left empty.
> 3. The controller checks `extractedData.orderId`:
>    * If set, it queries the database for that specific order number.
>    * If empty, it falls back to the user's active table order.
> 4. It formats a status update message and returns it.

### Q15: Why is `ACCOUNT_MODIFICATION` classified as an intent if the agent is not allowed to change account details?
> **Answer**: 
> This is a **security isolation pattern**. Rather than trying to parse details inside the chat (which is vulnerable to social engineering or injection), we classify the intent as `ACCOUNT_MODIFICATION` and route it to a secure handler. This handler blocks the request and replies with instructions: *"For security reasons, I cannot update your details in this chat. Please log in and navigate to Account Settings."*

### Q16: How does the agent handle `REFUND_REQUEST` eligibility checks?
> **Answer**: 
> 1. When classified as `REFUND_REQUEST`, the controller grabs the target order.
> 2. It queries `OrderService.verifyRefundEligibility(orderId)`.
> 3. The service checks the database:
>    * If the order has already been refunded, it denies the request.
>    * If the order does not exist, it denies the request.
> 4. If eligible, it flags the order as escalated (`refundStatus = "ESCALATED"`) in the database.
> 5. The agent notifies the user that the request has been submitted to a manager for manual review.

### Q17: What does the `ESCALATION` handler do in the database?
> **Answer**: 
> When classified as `ESCALATION`, the controller flags the user's active order in the database with a review reason (e.g. *"Escalated via chat: [Reason]"*), setting `refundStatus = "ESCALATED"`. 
> This pushes the order to the administrator's review queue in the admin portal, alerting staff to visit the table and assist the customer.

### Q18: What is the benefit of mapping classification routing in a `switch` block in Next.js backend instead of inside the LLM?
> **Answer**: 
> It ensures **deterministic routing**. By running the intent router inside our Next.js backend controller (`route.ts`), we ensure that routing flows, database saves, and transactions follow strict rules. This prevents the LLM from making unauthorized database writes or state changes.

---

## ✍️ Category D: Prompt Engineering & Context Assembly

### Q19: How do you construct the dynamic context payload for the prompt?
> **Answer**: 
> In `route.ts`, before making the LLM call, we build the context strings:
> * **Menu Context**: We query all items from the database, filtering out out-of-stock items, and map them to a formatted string listing IDs, names, prices, and categories.
> * **Order Context**: We fetch the user's active order details and serialize the items, totals, and statuses.
> This data is injected into the system prompt template, giving the model real-time context on menu items and order statuses.

### Q20: Why do we serialize the menu list as text instead of sending raw JSON to the prompt?
> **Answer**: 
> While LLMs can parse raw JSON, it is token-heavy and contains metadata (like database timestamps) that the model doesn't need. 
> Serializing only the necessary attributes (ID, Name, Price, Stock) reduces token usage, speeds up response times, and makes the prompt clean and easy for the model to parse.

### Q21: How do you restrict the Gemini prompt context length to prevent token bloat?
> **Answer**: 
> We slice the conversation history before sending it to the model:
> `const recentHistory = history.length > 9 ? history.slice(-9) : history;`
> We only send the last 9 messages, keeping the prompt small and fast while maintaining enough context for the conversation.

### Q22: What instruction is given to the agent to resolve meal classification queries (e.g., breakfast requests)?
> **Answer**: 
> The prompt includes a rule:
> *"For GENERAL_INQUIRY, analyze the user's request. If they ask about breakfast, analyze the menu items, identify which items fit breakfast (beverages, snacks), and recommend those items directly using standard recommendations."*
> This allows the model to map breakfast queries to items like Masala Chai or Coffee.

### Q23: Why do we instruct the LLM: "Do NOT prefix your responses with '🤖 [AI Chef]' or any similar tag"?
> **Answer**: 
> Emojis and bot tags in chat bubbles look cluttered. Removing the prefix makes the chat bubble look clean and matches our minimalist Zinc dark theme.

### Q24: How does the system prompt instruct the agent to match generic names (like "tea") to specific menu IDs?
> **Answer**: 
> The prompt guidelines state:
> *"If the user requests a generic item name, map it to the closest matching in-stock database item ID."*
> This enables the model to map *"tea"* to our database item `"item-tea"` (Masala Chai).

---

## 🛡️ Category E: Security Engineering, Prompt Injection, & Guardrails

### Q25: What is the "Cookie Spoofing" vulnerability, and how did you resolve it?
> **Answer**: 
> Previously, session cookies were stored in raw plaintext JSON. An attacker could edit their cookie value in the browser, changing their role from `"CUSTOMER"` to `"ADMIN"`, gaining access to the administration portal.
> **The Solution**: We implemented **AES-256-CBC** encryption using Node.js's native `crypto` module. Now, session data is encrypted with a secret key and a unique IV. Any attempt to modify the cookie value corrupts the decryption process, causing the backend to discard the session safely.

### Q26: What is an Insecure Direct Object Reference (IDOR) vulnerability, and how did you solve it in this project?
> **Answer**: 
> The order status endpoint `/api/order-status?id=...` returned order details without verification, allowing users to enumerate order IDs to view others' private information.
> **The Solution**: We implemented session validation. The route verifies that the user is an `ADMIN`, `KITCHEN` staff, or the specific `CUSTOMER` who owns the order before returning details.

### Q27: How does this project prevent Prompt Injection attacks from executing unauthorized refunds?
> **Answer**: 
> All state mutations (like issuing a refund or updating menu items) are restricted to Server Actions that verify the administrator's role server-side. The AI assistant has no write access to the database; it can only request a refund escalation, which must be approved by a human manager.

### Q28: How does the backend prevent users from draining their virtual wallets by submitting concurrent order requests?
> **Answer**: 
> This is a race condition threat. During checkouts, we check the user's balance and deduct the order cost. For production environments, we recommend executing these operations inside database transactions (`prisma.$transaction`) with atomic updates:
> `UPDATE User SET balance = balance - :total WHERE id = :id AND balance >= :total`.
> This guarantees that balance deductions and checkouts happen as a single database operation, preventing double-spending.

### Q29: What is the vulnerability of exposing database ID structures in chat recommendation triggers, and how is it handled?
> **Answer**: 
> Exposing internal database keys in the chat could reveal database structure information to attackers. 
> To mitigate this, our database keys use random UUIDs or random hash strings (e.g. `item-tea`, `item-a9d2x1`), preventing attackers from guessing other item IDs.

### Q30: How does the application prevent cross-site scripting (XSS) in the chat logs?
> **Answer**: 
> We sanitize input messages before saving them to the database and render chat text safely in React. The parser converts double-star markdown (`**bold**`) to JSX elements using native text nodes, avoiding the use of `dangerouslySetInnerHTML`.

---

## ⚡ Category F: API Resiliency, Fallbacks, & Rate Limits

### Q31: How does the offline classifier fallback engine work, and when is it triggered?
> **Answer**: 
> The fallback engine is triggered if the Gemini API key is missing, if requests fail, or if rate limits are hit.
> It uses regex keyword matching on the user's message:
> * If the message contains terms like *"refund"* or *"cancellation"*, it classifies the intent as `REFUND_REQUEST`.
> * If it contains *"status"* or *"track"*, it classifies the intent as `ORDER_STATUS`.
> * If it contains *"order"* or *"buy"*, it classifies the intent as `PLACE_ORDER`.
> It maps matched items to menu database IDs, returning a structured fallback response to keep the app functional offline.

### Q32: Why did you implement an exponential backoff retry queue for the AI agent?
> **Answer**: 
> API services can experience transient failures due to network congestion or rate limits (HTTP 429). 
> Our `callWithRetry` helper implements exponential backoff. If a request fails, it waits (`delay`), retrying up to 3 times while doubling the wait duration after each failure. This resolves transient errors without failing the request immediately.

### Q33: How does the API prevent billing exhaustion from spam attacks?
> **Answer**: 
> To prevent rate-limit spam attacks, we recommend implementing server-side rate-limiting middleware (e.g. redis-backed token bucket) on `/api/chat`, limiting clients to 10 chat messages per minute.

### Q34: How did you fix the Prisma crash on phone numbers containing the `+` prefix?
> **Answer**: 
> The crash was caused by using Prisma's case-insensitive filter (`mode: "insensitive"`) on phone numbers containing the `+` character. Prisma translates this filter into a MongoDB `$regexMatch` query. Since `+` is a regex quantifier, placing it at the start of a pattern throws a regex compilation error. We resolved this by checking if the identifier is an email (contains `@`) before applying the case-insensitive filter. For phone numbers, we use exact matching, avoiding regex compilation errors.

### Q35: How does the application notify the kitchen in real-time when a user places an order via the AI Chef?
> **Answer**: 
> The KDS dashboard polls the `/api/orders` endpoint every 7 seconds. When an order is placed via chat, it is written to the database. On the next poll, the KDS detects the new active order and plays an audio alert beep, alerting kitchen staff immediately.

### Q36: How does the AI Assistant enforce customer wallet balance limits before checkout transactions?
> **Answer**: 
> 1. The customer's live wallet balance is queried from the database and passed to `AIService` as context.
> 2. The prompt includes guidelines telling the model to verify if the total cost of requested dishes exceeds the balance.
> 3. If funds are insufficient, the LLM refuses ordering, classifies the intent as `GENERAL_INQUIRY` (preventing order creation), states the balance details, and directs them to the top-up simulation button inside their profile menu.

### Q37: Why is it necessary to invoke `router.refresh()` on the client side after checkouts or top-ups?
> **Answer**: 
> Next.js App Router caches page layouts on the client. If the wallet balance changes in the database, the Header balance indicator remains stale until a refresh is triggered. Calling `router.refresh()` instructs Next.js to purge the client-side router cache, re-fetch the latest balance server-side, and re-render the Header components seamlessly.
