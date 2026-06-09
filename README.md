# CampusBite | Smart Contactless University Cafeteria Ordering System

**Live Web Application**: [https://campus-bite.shahriarmehedi.me](https://campus-bite.shahriarmehedi.me)

CampusBite is a modern, responsive, and contactless dining platform designed to digitize and optimize campus cafeteria operations. Students and customers can scan table-specific QR codes to browse live menus, place orders with special instructions, track their food preparation status in real time, and consult an intelligent AI assistant. 

Cafeteria workers and admins are equipped with specialized dashboards: a touch-friendly Kitchen Display System (KDS) and a full-featured Management Admin Control Panel with sales analytics, menu management, and QR code generation.

---

## 🚀 Key Features & Modules

### 1. 📱 Contactless QR-Based Customer Ordering (`/table/[number]`)
- **Table Session Auto-Validation**: Scanning a table QR code (or selecting a table) creates a dining session mapped to that table (supports up to 20 tables).
- **Interactive Menu Browser**: Browse categories (Appetizers, Mains, Desserts, Beverages) and check prices. Out-of-stock items are automatically disabled.
- **Dynamic Shopping Basket**: Add/remove items, specify special cooking instructions (e.g., "no onions", "extra spicy"), and view calculations instantly in Bangladeshi Taka (৳).
- **Real-Time Order Tracker**: Progress bar tracking order status (`RECEIVED` ➜ `PREPARING` ➜ `READY` ➜ `COMPLETED`). Updates are polled automatically in the background.
- **Order History Portal**: Displays the history of all orders placed at that table or account session.

### 2. 🤖 Smart AI Chef Chatbot Assistant
- **Upgraded API Engine**: Powered by Google's **Gemini 3.5 Flash** (`gemini-3.5-flash`) for fast, natural language chat responses.
- **Context-Aware Recommendations**: Recommends items dynamically based on live database stock levels and the user's specific cravings (e.g., desserts, drinks, main meals) rather than generic static responses.
- **Swipeable Carousel Recommendations**: Recommended food items in the chat window are rendered as a horizontal swipeable slider. Customers can add recommended items directly to their cart from the chat bubble with a single tap.
- **Real-Time Order Status Checking**: The AI reads active order metadata (items, status, prices) from the database to answer status questions (e.g., *"Where is my food?"* or *"What is my order status?"*) accurately in English or Bangla.
- **Intelligent Fallback Engine**: If no API key is set, the system gracefully falls back to a custom rule-based local AI assistant to ensure smooth demo operation.

### 3. 🍳 Kitchen Display System (KDS) (`/kitchen`)
- **Touch-Friendly Ticket Board**: Lists active incoming orders with detail cards showing table number, items, quantities, and cooking instructions.
- **Checklist Workflow**: Staff can check off items on the ticket as they prepare them.
- **Sound Alert Notifications**: Emits an audible synthesized chime to alert the kitchen crew the moment a new customer order is placed.
- **Status Control**: Advance order status from Received ➜ Cooking ➜ Ready for Pickup ➜ Completed.

### 4. 🛡️ Admin Management & Control Panel (`/admin`)
- **Analytics & Sales Reports**: Dynamic CSS-based charts detailing traffic volume, total revenue, average order value, and best-selling menu items.
- **Live Menu Manager**: Fully functional CRUD panel to add new menu items, edit descriptions, adjust prices, assign categories, choose emojis, and toggle in/out of stock.
- **QR Code Engine**: Automatically generates unique, printable table QR codes matching the app's routing configuration (`/table/X`).

---

## 🛠️ Technology Stack & Architecture

- **Frontend & Routing**: Next.js 16.2.7 (React 19, App Router)
- **Database Client & ORM**: Prisma Client v6.19.3
- **Primary Database**: MongoDB Atlas (Cloud Replica Set)
- **AI Core**: `@google/generative-ai` (Gemini 3.5 Flash Model)
- **Styling**: Vanilla CSS (Global Glassmorphism Dark-Mode UI/UX design)
- **Mobile Responsiveness**:
  - Graceful grid wrapping to prevent content overlapping on small screens.
  - Custom horizontal swipeable slider components for chat recommendations to prevent vertical congestion.
  - `160px` bottom-scroll safety padding to ensure floating action buttons (FABs) do not obscure active menu cards.

---

## 💡 Fallback Demo Mode (Zero-Config Testing)

For smooth academic evaluations and offline demonstrations, CampusBite features a **graceful local mock fallback**. If a MongoDB URI or Gemini API key is missing:
1. The app automatically enters **Mock Mode** (indicated by a warning badge in the header).
2. The database swaps to a local JSON database (`db-mock.json` in the root).
3. The AI chat switches to a custom local assistant that parses categories, filters out-of-stock items, tracks active order states, and handles queries.

---

## 🚀 Local Installation & Setup

### 1. Install Node.js Dependencies
Clone this repository and run:
```bash
npm install
```

### 2. Generate Prisma Database Client
Initialize database schemas and type safety adapters:
```bash
npx prisma generate
```

### 3. Environment Variable Configuration
Rename or create a `.env` / `.env.local` file in the project root:
```env
# MongoDB Atlas replica set URI
DATABASE_URL="mongodb+srv://<username>:<password>@cluster.mongodb.net/campusbite?retryWrites=true&w=majority"

# Google AI Studio Gemini API Key
GEMINI_API_KEY="AIzaSy..."

# Base URL (for local QR generation)
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```
*(If you leave these credentials blank, the app will automatically boot in Mock Mode).*

### 4. Push Database Schema (Only when using Live MongoDB)
Push the Prisma schemas to MongoDB:
```bash
npx prisma db push
```

### 5. Start the Development Server
Run:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) inside your web browser. 

*To test mobile views, press `F12` in Google Chrome to open DevTools, and click the **Device Toggle Toolbar (Ctrl+Shift+M)**.*

---

## 🔑 Quick Login Credentials (Demo Accounts)

To make presentations quick and easy, the login screen (`/login`) includes instant role login cards. You can tap on them to sign in as:
- 🎓 **Student / Customer**: `student@campusbite.com`
- 🍳 **Kitchen Staff**: `kitchen@campusbite.com`
- 🛡️ **Administrator**: `admin@campusbite.com`
