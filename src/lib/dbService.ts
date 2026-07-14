import { prisma, isPrismaActive } from "./db";
import { mockDb, User, Table, MenuItem, Order, OrderItem, ChatMessage } from "./mockDb";

export const dbService = {
  // Check Mode
  isMockMode: () => !isPrismaActive,

  // Users
  getUsers: async (): Promise<User[]> => {
    if (isPrismaActive && prisma) {
      const dbUsers = await prisma.user.findMany();
      return dbUsers.map((u) => ({ ...u, createdAt: new Date(u.createdAt) }));
    }
    return mockDb.getUsers();
  },

  getUserByEmail: async (email: string): Promise<User | undefined> => {
    if (isPrismaActive && prisma) {
      const u = await prisma.user.findFirst({ where: { email } });
      return u ? { ...u, createdAt: new Date(u.createdAt) } : undefined;
    }
    return mockDb.getUserByEmail(email);
  },

  getUserByPhone: async (phone: string): Promise<User | undefined> => {
    if (isPrismaActive && prisma) {
      const u = await prisma.user.findFirst({ where: { phone } });
      return u ? { ...u, createdAt: new Date(u.createdAt) } : undefined;
    }
    return mockDb.getUserByPhone(phone);
  },

  getUserByIdentifier: async (identifier: string): Promise<User | undefined> => {
    if (isPrismaActive && prisma) {
      const cleanId = identifier.trim();
      if (cleanId.includes("@")) {
        const emailUser = await prisma.user.findFirst({ where: { email: { equals: cleanId, mode: "insensitive" } } });
        if (emailUser) return { ...emailUser, createdAt: new Date(emailUser.createdAt) } as any;
      } else {
        const phoneUser = await prisma.user.findFirst({ where: { phone: cleanId } });
        if (phoneUser) return { ...phoneUser, createdAt: new Date(phoneUser.createdAt) } as any;
      }
      return undefined;
    }
    return mockDb.getUserByIdentifier(identifier);
  },

  updateUserBalance: async (id: string, newBalance: number): Promise<User | null> => {
    if (isPrismaActive && prisma) {
      try {
        const u = await prisma.user.update({
          where: { id },
          data: { balance: newBalance } as any,
        });
        return { ...u, createdAt: new Date(u.createdAt) } as any;
      } catch {
        return null;
      }
    }
    return mockDb.updateUserBalance(id, newBalance);
  },

  createUser: async (user: { email?: string | null; phone?: string | null; name?: string | null; role: string; balance?: number }): Promise<User> => {
    if (isPrismaActive && prisma) {
      const u = await prisma.user.create({
        data: {
          email: user.email || null,
          phone: user.phone || null,
          name: user.name || null,
          role: user.role,
        },
      });
      return { ...u, createdAt: new Date(u.createdAt) } as any;
    }
    return mockDb.createUser(user);
  },

  // Tables
  getTables: async (): Promise<Table[]> => {
    if (isPrismaActive && prisma) {
      const dbTables = await prisma.table.findMany({ orderBy: { number: "asc" } });
      return dbTables.map((t) => ({ ...t, createdAt: new Date(t.createdAt) }));
    }
    return mockDb.getTables();
  },

  getTableByNumber: async (num: number): Promise<Table | undefined> => {
    if (isPrismaActive && prisma) {
      const t = await prisma.table.findUnique({ where: { number: num } });
      return t ? { ...t, createdAt: new Date(t.createdAt) } : undefined;
    }
    return mockDb.getTableByNumber(num);
  },

  createTable: async (num: number): Promise<Table> => {
    if (isPrismaActive && prisma) {
      const existing = await prisma.table.findUnique({ where: { number: num } });
      if (existing) return { ...existing, createdAt: new Date(existing.createdAt) };
      const t = await prisma.table.create({
        data: { number: num, status: "ACTIVE" },
      });
      return { ...t, createdAt: new Date(t.createdAt) };
    }
    return mockDb.createTable(num);
  },

  updateTable: async (id: string, updates: { status?: string }): Promise<Table | null> => {
    if (isPrismaActive && prisma) {
      try {
        const t = await prisma.table.update({
          where: { id },
          data: updates,
        });
        return { ...t, createdAt: new Date(t.createdAt) };
      } catch {
        return null;
      }
    }
    return mockDb.updateTable(id, updates);
  },

  deleteTable: async (id: string): Promise<boolean> => {
    if (isPrismaActive && prisma) {
      try {
        await prisma.table.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    }
    return mockDb.deleteTable(id);
  },

  // MenuItems
  getMenuItems: async (): Promise<MenuItem[]> => {
    if (isPrismaActive && prisma) {
      const items = await prisma.menuItem.findMany();
      return items.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
    }
    return mockDb.getMenuItems();
  },

  getMenuItem: async (id: string): Promise<MenuItem | undefined> => {
    if (isPrismaActive && prisma) {
      const m = await prisma.menuItem.findUnique({ where: { id } });
      return m ? { ...m, createdAt: new Date(m.createdAt) } : undefined;
    }
    return mockDb.getMenuItem(id);
  },

  createMenuItem: async (item: {
    name: string;
    description: string;
    price: number;
    image: string;
    category: string;
    status: string;
    stock?: number;
  }): Promise<MenuItem> => {
    if (isPrismaActive && prisma) {
      const m = await prisma.menuItem.create({ data: { ...item, stock: item.stock ?? 50 } });
      return { ...m, createdAt: new Date(m.createdAt) };
    }
    return mockDb.createMenuItem({ ...item, stock: item.stock ?? 50 });
  },

  updateMenuItem: async (id: string, updates: Partial<MenuItem>): Promise<MenuItem | null> => {
    if (isPrismaActive && prisma) {
      try {
        const m = await prisma.menuItem.update({
          where: { id },
          data: updates,
        });
        return { ...m, createdAt: new Date(m.createdAt) };
      } catch {
        return null;
      }
    }
    return mockDb.updateMenuItem(id, updates);
  },

  deleteMenuItem: async (id: string): Promise<boolean> => {
    if (isPrismaActive && prisma) {
      try {
        await prisma.menuItem.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    }
    return mockDb.deleteMenuItem(id);
  },

  // Orders
  getOrders: async (): Promise<Order[]> => {
    if (isPrismaActive && prisma) {
      const orders = await prisma.order.findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" },
      });
      return orders.map((o) => ({
        ...o,
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt),
        items: o.items.map((it) => ({ ...it })),
      }));
    }
    return mockDb.getOrders();
  },

  getOrder: async (id: string): Promise<Order | undefined> => {
    if (isPrismaActive && prisma) {
      const o = await prisma.order.findUnique({
        where: { id },
        include: { items: true },
      });
      return o
        ? {
            ...o,
            createdAt: new Date(o.createdAt),
            updatedAt: new Date(o.updatedAt),
            items: o.items.map((it) => ({ ...it })),
          }
        : undefined;
    }
    return mockDb.getOrder(id);
  },

  createOrder: async (orderData: {
    tableNumber: number;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerName?: string | null;
    specialInstructions?: string | null;
    items: Omit<OrderItem, "id" | "orderId">[];
  }): Promise<Order> => {
    if (isPrismaActive && prisma) {
      const orderNumber = "CB-" + Math.floor(1000 + Math.random() * 9000);
      const total = orderData.items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

      const o = await prisma.order.create({
        data: {
          orderNumber,
          tableNumber: orderData.tableNumber,
          customerPhone: orderData.customerPhone || null,
          customerEmail: orderData.customerEmail || null,
          customerName: orderData.customerName || null,
          status: "RECEIVED",
          total,
          specialInstructions: orderData.specialInstructions || null,
          items: {
            create: orderData.items.map((item) => ({
              menuItemId: item.menuItemId,
              menuItemName: item.menuItemName,
              price: item.price,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      return {
        ...o,
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt),
        items: o.items.map((it) => ({ ...it })),
      };
    }
    return mockDb.createOrder(orderData);
  },

  updateOrder: async (id: string, updates: Partial<Order>): Promise<Order | null> => {
    if (isPrismaActive && prisma) {
      try {
        // Strip items if passed as we update order fields directly
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { items, ...directUpdates } = updates;
        const o = await prisma.order.update({
          where: { id },
          data: directUpdates as any,
          include: { items: true },
        });
        return {
          ...o,
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt),
          items: o.items.map((it) => ({ ...it })),
        };
      } catch {
        return null;
      }
    }
    return mockDb.updateOrder(id, updates);
  },

  // ChatMessages
  getChatMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    if (isPrismaActive && prisma) {
      const msgs = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
      });
      return msgs.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
    }
    return mockDb.getChatMessages(sessionId);
  },

  createChatMessage: async (sessionId: string, role: string, content: string): Promise<ChatMessage> => {
    if (isPrismaActive && prisma) {
      const m = await prisma.chatMessage.create({
        data: { sessionId, role, content },
      });
      return { ...m, createdAt: new Date(m.createdAt) };
    }
    return mockDb.createChatMessage(sessionId, role, content);
  },

  clearChatMessages: async (sessionId: string): Promise<void> => {
    if (isPrismaActive && prisma) {
      await prisma.chatMessage.deleteMany({ where: { sessionId } });
      return;
    }
    return mockDb.clearChatMessages(sessionId);
  },
};
