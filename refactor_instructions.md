# Refactor Instructions: Campus-Bite AI Agent Guardrails & Code Quality

## Context
This project is being upgraded from a sandbox MVP to a production-grade architecture. The primary goal is to restrict the AI's autonomy and ensure the codebase reflects Senior-level software engineering standards. The code will be presented in a live technical architecture review.

Please review the current webhook/API route handling the AI agent and implement the following strict architectural constraints and clean-code standards.

## Task 1: Enforce Strict Intent Parsing
Refactor the LLM system prompt and execution flow. The LLM must not call execution functions directly.
*   **Action:** Update the prompt to force the LLM to return a strict JSON object classifying the user's message.
*   **Expected Intents:** `ORDER_STATUS`, `REFUND_REQUEST`, `ACCOUNT_MODIFICATION`, `ESCALATION`, `GENERAL_INQUIRY`.
*   **Requirement:** The backend must intercept this JSON and use a `switch` or `if/else` block to trigger the corresponding backend service function.

## Task 2: Implement Refund Guardrails (Human-in-the-Loop)
The AI must never have unsupervised financial authority or direct access to the payment gateway API (e.g., Stripe) to execute refunds.
*   **Action:** Locate the logic block for handling refund requests.
*   **Requirement:** Remove any code where the AI directly triggers a payment refund.
*   **Replacement Logic:** When the `REFUND_REQUEST` intent is detected, the backend must:
    1. Query the database to verify the order exists and is eligible for a refund.
    2. Update the order status in the database to `pending_refund_review` or `requires_human_approval`.
    3. Instruct the LLM to draft a response stating: *"I have escalated your refund request to our support team for manual review."*

## Task 3: Strip Account Modification Autonomy
The AI must not be able to modify user details (addresses, payment methods, phone numbers) due to security risks.
*   **Action:** Audit the tools/functions available to the AI. Remove any functions like `updateUserAddress`, `changePaymentMethod`, or `updateContactInfo`.
*   **Replacement Logic:** If the intent is `ACCOUNT_MODIFICATION`, the backend must bypass the LLM and return a hardcoded response directing the user to log into the secure portal to make changes (enforcing standard auth).

## Task 4: Build the Escalation / Fallback Pipeline
The system needs a safety net for complex, unrecognized, or highly toxic inputs.
*   **Action:** Implement a `default` case in the intent handling block.
*   **Requirement:** If the LLM confidence score is low, the intent is unrecognized, or the intent is flagged as `ESCALATION`, the system must flag the database record for human intervention and notify the user that a support agent will contact them.

## Task 5: Senior-Level Code Quality & Architecture Standards (CRITICAL)
The resulting codebase must be highly readable, modular, and production-ready. Please apply the following standards to the refactored code:

1.  **Separation of Concerns (No Monoliths):** Do not leave all logic in a single 500-line route handler. Separate the logic into distinct files/modules:
    *   `route.ts` (API endpoint, only handles request/response and high-level try/catch).
    *   `ai.service.ts` (Handles LLM API calls, prompts, and intent parsing).
    *   `order.service.ts` (Handles database queries, mutations, and business logic like checking refund eligibility).
2.  **Strict TypeScript:** 
    *   No `any` types. 
    *   Define strict `interfaces` or `types` for the expected LLM JSON output (e.g., `IntentResponse`), database payloads, and API responses.
3.  **Robust Error Handling & Observability:**
    *   Wrap asynchronous operations in `try/catch` blocks.
    *   Do not just `console.log(error)`. Use structured logging formats (e.g., `console.error({ event: 'LLM_PARSE_ERROR', details: error.message })`).
    *   Ensure the webhook always returns a graceful HTTP response (e.g., `200 OK` for success, or `500` with a safe generic message so internal stack traces aren't leaked).
4.  **Security Best Practices:** Ensure no API keys (OpenAI, Stripe, DB credentials) are hardcoded. All must be referenced strictly via `process.env`.
5.  **Self-Documenting Code:** Use clear, descriptive variable names (`isRefundEligible` instead of `checkRef`). Add brief, high-level JSDoc comments above complex business logic functions explaining the *why*, not just the *what*.