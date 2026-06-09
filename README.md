# CampusBite | QR-Based Cafeteria Ordering System with AI Assistant

CampusBite is a smart, contactless cafeteria management platform built for university campuses. Designed to run smoothly on mobile screens as well as desktop dashboards, it allows students to scan table QR codes to browse real-time menus, place customized orders, track food preparation status, and consult an AI assistant for recommendations and stock inquiries.

The project is built using **Next.js 16 (App Router)**, **Prisma**, **MongoDB**, and **Gemini AI**.

---

## 🌟 Key Features

1. **Passwordless Quick Authentication**: Sign in using a phone number or email instantly. Includes a **Demo Account Quick Login** panel to easily test roles during presentations.
2. **Contactless Ordering via QR**: Simulates scanning table QR codes (supported up to 20 tables). Each table has a dedicated, auto-validated session page (`/table/[number]`).
3. **AI Chatbot Assistant (Gemini)**: A floating chat assistant powered by Gemini. It queries the live database to check real-time stock levels, item descriptions, and categories to recommend food to students.
4. **Kitchen Display System (KDS)**: Touch-friendly kitchen dashboard showing incoming tickets with a checklist. Emits a synthesized **sound chime** whenever a new order is received.
5. **Admin Control Center**:
   - **Analytics & Dashboard**: CSS-based traffic graphs, total sales, and best-selling item tracking.
   - **Menu Manager**: Add, edit, delete menu items, set prices, choose visual emojis, and toggle in-stock/out-of-stock.
   - **QR Generator**: Generates dining-table QR codes on-the-fly inside the browser. Admins can print or download them.

---

## 🛠️ Technology Stack

* **Frontend Framework**: Next.js 16.2.7 (React 19, App Router)
* **Styling**: Vanilla CSS (Global Dark-Theme Glassmorphic stylesheet)
* **Database Client**: Prisma v6 (MongoDB datasource adapter)
* **AI Engine**: `@google/generative-ai` (Gemini-1.5-Flash model)
* **Utilities**: `qrcode` (for on-the-fly QR code drawing), `lucide-react` (for modern icons)

---

## 💡 Fallback Demo Mode (Zero-Config Testing)

For ease of academic demonstration, **CampusBite has a graceful local fallback mode**. If no database connection or Gemini API key is configured:
1. The app automatically switches to **Mock Mode**.
2. It reads and writes data to a local file database (`db-mock.json` in the project root).
3. The AI Chatbot switches to a local rule-based AI engine that responds about prices and recommendations.
4. A warning banner at the top of the header will notify you that you are running in mock mode.

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org) installed on your machine.

### 2. Installation
Install all dependencies:
```bash
npm install
```

### 3. Generate Prisma Client
Generate the type safety client for model schemas:
```bash
npx prisma generate
```

### 4. Running Locally
Run the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
To simulate mobile devices, open Google Chrome DevTools and toggle the Device Toolbar (Ctrl+Shift+M).

---

## 🔗 Connecting MongoDB Atlas & Gemini AI

Once you are ready to connect to a live MongoDB cloud database and live Gemini API:

1. Create a **MongoDB Atlas** database cluster. Get your connection string (replica set recommended for nested writes).
2. Get a **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).
3. Rename/configure `.env.local` and paste your credentials:
   ```env
   DATABASE_URL="mongodb+srv://<username>:<password>@cluster.mongodb.net/campusbite?retryWrites=true&w=majority"
   GEMINI_API_KEY="AIzaSy..."
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"
   ```
4. Push the schema to your MongoDB Atlas database:
   ```bash
   npx prisma db push
   ```
5. Restart the server:
   ```bash
   npm run dev
   ```
   The warning banner will disappear, and the app will operate on your live MongoDB cloud database and Gemini API.

---

## 🔑 Quick Login Demo Accounts

When visiting the login screen (`/login`), click any quick card to instantly sign in as:
* 🎓 **Customer**: `student@campusbite.com`
* 🍳 **Kitchen Staff**: `kitchen@campusbite.com`
* 🛡️ **Administrator**: `admin@campusbite.com`
