import fs from "fs";
import path from "path";

const MOCK_FILE_PATH = path.join(process.cwd(), "db-mock.json");

export interface User {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  role: string;
  createdAt: Date;
}

export interface Table {
  id: string;
  number: number;
  status: string; // ACTIVE, INACTIVE
  createdAt: Date;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string; // APPETIZERS, MAIN_COURSES, DESSERTS, BEVERAGES
  status: string; // IN_STOCK, OUT_OF_STOCK
  createdAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  tableNumber: number;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  status: string; // RECEIVED, PREPARING, READY, COMPLETED, CANCELLED
  total: number;
  specialInstructions?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  refundReason?: string | null;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: string; // user, model
  content: string;
  createdAt: Date;
}

interface MockData {
  users: User[];
  tables: Table[];
  menuItems: MenuItem[];
  orders: Order[];
  chatMessages: ChatMessage[];
}

const initialUsers: User[] = [
  {
    id: "user-admin-1",
    email: "admin@campusbite.com",
    phone: "1234567890",
    name: "Admin User",
    role: "ADMIN",
    createdAt: new Date(),
  },
  {
    id: "user-kitchen-1",
    email: "kitchen@campusbite.com",
    phone: "0987654321",
    name: "Kitchen Staff",
    role: "KITCHEN",
    createdAt: new Date(),
  },
  {
    id: "user-student-1",
    email: "student@campusbite.com",
    phone: "5555555555",
    name: "Alex Smith",
    role: "CUSTOMER",
    createdAt: new Date(),
  },
];

const initialTables: Table[] = [
  { id: "table-1", number: 1, status: "ACTIVE", createdAt: new Date() },
  { id: "table-2", number: 2, status: "ACTIVE", createdAt: new Date() },
  { id: "table-3", number: 3, status: "ACTIVE", createdAt: new Date() },
  { id: "table-4", number: 4, status: "ACTIVE", createdAt: new Date() },
  { id: "table-5", number: 5, status: "ACTIVE", createdAt: new Date() },
];

const initialMenuItems: MenuItem[] = [
  {
    id: "item-khichuri",
    name: "Khichuri",
    description: "Traditional Bangladeshi Khichuri cooked with lentils, premium rice, ghee, and aromatic spices.",
    price: 100,
    image: "🍛",
    category: "MAIN_COURSES",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
  {
    id: "item-1",
    name: "Chicken Biryani",
    description: "Aromatic basmati rice cooked with tender spiced chicken, served with a boiled egg.",
    price: 220,
    image: "🍛",
    category: "MAIN_COURSES",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
  {
    id: "item-2",
    name: "Crispy Chicken Burger",
    description: "Golden fried chicken breast, lettuce, tomato, special sauce, toasted brioche bun.",
    price: 180,
    image: "🍔",
    category: "MAIN_COURSES",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
  {
    id: "item-3",
    name: "Loaded Cheesy Fries",
    description: "Crispy french fries topped with melted cheddar cheese, jalapenos, and spring onions.",
    price: 120,
    image: "🍟",
    category: "APPETIZERS",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
  {
    id: "item-4",
    name: "Fried Chicken (2 pcs)",
    description: "Crunchy, double-spiced golden fried chicken pieces, served with garlic sauce.",
    price: 140,
    image: "🍗",
    category: "APPETIZERS",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
  {
    id: "item-5",
    name: "Chocolate Fudge Brownie",
    description: "Rich, warm chocolate brownie served with chocolate drizzle.",
    price: 110,
    image: "🍰",
    category: "DESSERTS",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
  {
    id: "item-6",
    name: "Ice Cream Sundae",
    description: "Double scoop of vanilla and strawberry ice cream topped with cherries.",
    price: 90,
    image: "🍨",
    category: "DESSERTS",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
  {
    id: "item-7",
    name: "Masala Chai",
    description: "Brewed black tea cooked with milk, cardamom, ginger, and secret spices.",
    price: 30,
    image: "☕",
    category: "BEVERAGES",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
  {
    id: "item-8",
    name: "Cold Coffee",
    description: "Blended espresso, chilled milk, vanilla ice cream, and chocolate syrup.",
    price: 80,
    image: "🥤",
    category: "BEVERAGES",
    status: "IN_STOCK",
    createdAt: new Date(),
  },
];

function initDb(): MockData {
  if (fs.existsSync(MOCK_FILE_PATH)) {
    try {
      const dataStr = fs.readFileSync(MOCK_FILE_PATH, "utf-8");
      const data = JSON.parse(dataStr);
      // Map ISO strings back to Dates
      return {
        users: (data.users || []).map((u: any) => ({ ...u, createdAt: new Date(u.createdAt) })),
        tables: (data.tables || []).map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })),
        menuItems: (data.menuItems || []).map((m: any) => ({ ...m, createdAt: new Date(m.createdAt) })),
        orders: (data.orders || []).map((o: any) => ({
          ...o,
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt),
        })),
        chatMessages: (data.chatMessages || []).map((c: any) => ({ ...c, createdAt: new Date(c.createdAt) })),
      };
    } catch (e) {
      console.error("Failed to parse mock database, resetting.", e);
    }
  }

  const defaultData: MockData = {
    users: initialUsers,
    tables: initialTables,
    menuItems: initialMenuItems,
    orders: [],
    chatMessages: [],
  };
  saveDb(defaultData);
  return defaultData;
}

function saveDb(data: MockData) {
  try {
    fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save mock database.", e);
  }
}

// Helper database manager API
export const mockDb = {
  // Users
  getUsers: (): User[] => {
    return initDb().users;
  },
  getUserByEmail: (email: string): User | undefined => {
    return initDb().users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  },
  getUserByPhone: (phone: string): User | undefined => {
    return initDb().users.find((u) => u.phone === phone);
  },
  createUser: (user: Omit<User, "id" | "createdAt">): User => {
    const db = initDb();
    const newUser: User = {
      ...user,
      id: "user-" + Math.random().toString(36).substring(2, 9),
      createdAt: new Date(),
    };
    db.users.push(newUser);
    saveDb(db);
    return newUser;
  },

  // Tables
  getTables: (): Table[] => {
    return initDb().tables.sort((a, b) => a.number - b.number);
  },
  getTableByNumber: (num: number): Table | undefined => {
    return initDb().tables.find((t) => t.number === num);
  },
  createTable: (num: number): Table => {
    const db = initDb();
    const existing = db.tables.find((t) => t.number === num);
    if (existing) return existing;
    const newTable: Table = {
      id: "table-" + Math.random().toString(36).substring(2, 9),
      number: num,
      status: "ACTIVE",
      createdAt: new Date(),
    };
    db.tables.push(newTable);
    saveDb(db);
    return newTable;
  },
  updateTable: (id: string, updates: Partial<Table>): Table | null => {
    const db = initDb();
    const index = db.tables.findIndex((t) => t.id === id);
    if (index === -1) return null;
    db.tables[index] = { ...db.tables[index], ...updates };
    saveDb(db);
    return db.tables[index];
  },
  deleteTable: (id: string): boolean => {
    const db = initDb();
    const initialLen = db.tables.length;
    db.tables = db.tables.filter((t) => t.id !== id);
    saveDb(db);
    return db.tables.length < initialLen;
  },

  // MenuItems
  getMenuItems: (): MenuItem[] => {
    return initDb().menuItems;
  },
  getMenuItem: (id: string): MenuItem | undefined => {
    return initDb().menuItems.find((m) => m.id === id);
  },
  createMenuItem: (item: Omit<MenuItem, "id" | "createdAt">): MenuItem => {
    const db = initDb();
    const newItem: MenuItem = {
      ...item,
      id: "item-" + Math.random().toString(36).substring(2, 9),
      createdAt: new Date(),
    };
    db.menuItems.push(newItem);
    saveDb(db);
    return newItem;
  },
  updateMenuItem: (id: string, updates: Partial<MenuItem>): MenuItem | null => {
    const db = initDb();
    const index = db.menuItems.findIndex((m) => m.id === id);
    if (index === -1) return null;
    db.menuItems[index] = { ...db.menuItems[index], ...updates };
    saveDb(db);
    return db.menuItems[index];
  },
  deleteMenuItem: (id: string): boolean => {
    const db = initDb();
    const initialLen = db.menuItems.length;
    db.menuItems = db.menuItems.filter((m) => m.id !== id);
    saveDb(db);
    return db.menuItems.length < initialLen;
  },

  // Orders
  getOrders: (): Order[] => {
    return initDb().orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },
  getOrder: (id: string): Order | undefined => {
    return initDb().orders.find((o) => o.id === id);
  },
  createOrder: (orderData: {
    tableNumber: number;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerName?: string | null;
    specialInstructions?: string | null;
    items: Omit<OrderItem, "id" | "orderId">[];
  }): Order => {
    const db = initDb();
    const orderId = "order-" + Math.random().toString(36).substring(2, 9);
    const orderNumber = "CB-" + Math.floor(1000 + Math.random() * 9000);
    const total = orderData.items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

    const items: OrderItem[] = orderData.items.map((item) => ({
      ...item,
      id: "item-" + Math.random().toString(36).substring(2, 9),
      orderId,
    }));

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      tableNumber: orderData.tableNumber,
      customerPhone: orderData.customerPhone || null,
      customerEmail: orderData.customerEmail || null,
      customerName: orderData.customerName || null,
      status: "RECEIVED",
      total,
      specialInstructions: orderData.specialInstructions || null,
      refundStatus: null,
      refundAmount: null,
      refundReason: null,
      items,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.orders.push(newOrder);
    saveDb(db);
    return newOrder;
  },
  updateOrder: (id: string, updates: Partial<Order>): Order | null => {
    const db = initDb();
    const index = db.orders.findIndex((o) => o.id === id);
    if (index === -1) return null;
    db.orders[index] = { ...db.orders[index], ...updates, updatedAt: new Date() };
    saveDb(db);
    return db.orders[index];
  },

  // ChatMessages
  getChatMessages: (sessionId: string): ChatMessage[] => {
    return initDb()
      .chatMessages.filter((m) => m.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },
  createChatMessage: (sessionId: string, role: string, content: string): ChatMessage => {
    const db = initDb();
    const newMsg: ChatMessage = {
      id: "msg-" + Math.random().toString(36).substring(2, 9),
      sessionId,
      role,
      content,
      createdAt: new Date(),
    };
    db.chatMessages.push(newMsg);
    saveDb(db);
    return newMsg;
  },
  clearChatMessages: (sessionId: string): void => {
    const db = initDb();
    db.chatMessages = db.chatMessages.filter((m) => m.sessionId !== sessionId);
    saveDb(db);
  },
};
