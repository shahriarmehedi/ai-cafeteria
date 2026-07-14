"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { MenuItem, Order, Table } from "@/lib/mockDb";
import { useToast } from "@/components/Toast";
import { SessionUser } from "@/lib/session";
import { manageMenuItemAction, manageTableAction, resolveEscalationAction } from "@/app/actions";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Plus,
  Trash,
  Edit2,
  QrCode,
  Download,
  X,
  PlusCircle,
  Loader2,
  Table as TableIcon,
  ChefHat,
  Coffee,
  Activity,
  AlertCircle,
} from "lucide-react";

interface Props {
  menuItems: MenuItem[];
  orders: Order[];
  tables: Table[];
  session: SessionUser;
}

export default function AdminDashboardView({ menuItems, orders, tables, session }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"STATS" | "MENU" | "TABLES" | "REFUNDS">("STATS");
  
  // Data State
  const [itemsList, setItemsList] = useState<MenuItem[]>(menuItems);
  const [tablesList, setTablesList] = useState<Table[]>(tables);
  const [ordersList, setOrdersList] = useState<Order[]>(orders);

  // Refund Action State
  const [refundLoading, setRefundLoading] = useState<string | null>(null);

  const handleResolveRefund = async (orderId: string, resolution: "REFUNDED" | "REFUND_DENIED") => {
    setRefundLoading(orderId);
    try {
      const res = await resolveEscalationAction(orderId, resolution);
      if (res.error) {
        toast(res.error, "error");
      } else {
        // Update local state reactively
        setOrdersList((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, refundStatus: resolution, refundAmount: resolution === "REFUNDED" ? o.total : null }
              : o
          )
        );
        toast(
          resolution === "REFUNDED" ? "Refund approved successfully!" : "Refund request denied.",
          resolution === "REFUNDED" ? "success" : "warning"
        );
        router.refresh();
      }
    } catch (err) {
      console.error("Refund resolution error:", err);
      toast("Failed resolving refund request.", "error");
    } finally {
      setRefundLoading(null);
    }
  };

  const getElapsedTime = (createdAt: Date) => {
    const mins = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
    return mins < 1 ? "Just now" : `${mins}m ago`;
  };

  // QR Modal State
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Menu Form State
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: "",
    description: "",
    price: "",
    image: "🍔",
    category: "MAIN_COURSES",
    status: "IN_STOCK",
    stock: "50",
  });
  const [menuLoading, setMenuLoading] = useState(false);

  // Table Form State
  const [newTableNum, setNewTableNum] = useState("");
  const [tableLoading, setTableLoading] = useState(false);

  // Tab 1: Stats Calculations
  const completedOrders = ordersList.filter((o) => o.status === "COMPLETED");
  const totalSales = completedOrders.reduce((acc, curr) => acc + curr.total, 0);
  const totalOrdersCount = completedOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;
  const activeOrdersCount = ordersList.filter((o) => ["RECEIVED", "PREPARING", "READY"].includes(o.status)).length;

  // Item Popularity Calculations (Quantity sold per item)
  const itemSalesMap: { [key: string]: number } = {};
  completedOrders.forEach((o) => {
    o.items.forEach((item) => {
      itemSalesMap[item.menuItemName] = (itemSalesMap[item.menuItemName] || 0) + item.quantity;
    });
  });

  const popularItems = Object.entries(itemSalesMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  const maxQtySold = popularItems.length > 0 ? Math.max(...popularItems.map((i) => i.qty)) : 1;

  // Generate QR Code on-the-fly
  const handleOpenQR = async (table: Table) => {
    setQrModalTable(table);
    setQrCodeUrl(""); // Clear previous QR code to prevent showing stale image
    try {
      // Prioritize window.location.origin so mobile devices on the same LAN/Wi-Fi can resolve the IP correctly
      const baseUrl = window.location.origin || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const targetUrl = `${baseUrl}/table/${table.number}`;
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
      setQrCodeUrl(dataUrl);
    } catch (err) {
      console.error("Failed creating QR Code", err);
    }
  };

  // Create or Update Menu Item
  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuLoading(true);

    const data = {
      name: menuForm.name,
      description: menuForm.description,
      price: parseFloat(menuForm.price) || 0,
      image: menuForm.image,
      category: menuForm.category,
      status: menuForm.status,
      stock: parseInt(menuForm.stock) !== undefined ? parseInt(menuForm.stock) : 50,
    };

    try {
      if (editingItem) {
        const res = await manageMenuItemAction("UPDATE", editingItem.id, data);
        if (res.success && res.item) {
          setItemsList((prev) => prev.map((item) => (item.id === editingItem.id ? res.item! : item)));
          setEditingItem(null);
        }
      } else {
        const res = await manageMenuItemAction("CREATE", undefined, data);
        if (res.success && res.item) {
          setItemsList((prev) => [...prev, res.item!]);
        }
      }
      setMenuForm({
        name: "",
        description: "",
        price: "",
        image: "🍔",
        category: "MAIN_COURSES",
        status: "IN_STOCK",
        stock: "50",
      });
    } catch (err) {
      console.error(err);
      alert("Failed submitting item.");
    } finally {
      setMenuLoading(false);
    }
  };

  const handleEditItemInit = (item: MenuItem) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      image: item.image,
      category: item.category,
      status: item.status,
      stock: (item.stock !== undefined ? item.stock : 50).toString(),
    });
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this food item?")) return;
    try {
      const res = await manageMenuItemAction("DELETE", id);
      if (res.success) {
        setItemsList((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStockStatus = async (item: MenuItem) => {
    const nextStatus = item.status === "IN_STOCK" ? "OUT_OF_STOCK" : "IN_STOCK";
    try {
      const res = await manageMenuItemAction("UPDATE", item.id, {
        ...item,
        status: nextStatus,
      });
      if (res.success && res.item) {
        setItemsList((prev) => prev.map((it) => (it.id === item.id ? res.item! : it)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create New Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const tableNum = parseInt(newTableNum);
    if (isNaN(tableNum) || tableNum <= 0) return;

    setTableLoading(true);
    try {
      const res = await manageTableAction("CREATE", { number: tableNum });
      if (res.success && res.table) {
        if (!tablesList.some((t) => t.id === res.table!.id)) {
          setTablesList((prev) => [...prev, res.table!].sort((a, b) => a.number - b.number));
        }
        setNewTableNum("");
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
    }
  };

  // Toggle Table Active Status
  const handleToggleTableStatus = async (table: Table) => {
    const nextStatus = table.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await manageTableAction("UPDATE", {
        id: table.id,
        number: table.number,
        status: nextStatus,
      });
      if (res.success && res.table) {
        setTablesList((prev) => prev.map((t) => (t.id === table.id ? res.table! : t)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Table
  const handleDeleteTable = async (table: Table) => {
    if (!confirm(`Are you sure you want to delete Table ${table.number}?`)) return;
    try {
      const res = await manageTableAction("DELETE", { id: table.id });
      if (res.success) {
        setTablesList((prev) => prev.filter((t) => t.id !== table.id));
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="desktop-container animate-fade-in" style={{ paddingBottom: "40px" }}>
      
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Cafeteria Dashboard</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Manage menu inventory, seating, and analytics.</p>
      </div>

      {/* Tabs */}
      <div className="tabs-header" style={{ maxWidth: "560px", marginBottom: "24px" }}>
        <button onClick={() => setActiveTab("STATS")} className={`tab-btn ${activeTab === "STATS" ? "active" : ""}`}>
          <TrendingUp size={13} style={{ marginRight: "3px", display: "inline" }} /> Stats
        </button>
        <button onClick={() => setActiveTab("MENU")} className={`tab-btn ${activeTab === "MENU" ? "active" : ""}`}>
          <Coffee size={13} style={{ marginRight: "3px", display: "inline" }} /> Menu Items
        </button>
        <button onClick={() => setActiveTab("TABLES")} className={`tab-btn ${activeTab === "TABLES" ? "active" : ""}`}>
          <TableIcon size={13} style={{ marginRight: "3px", display: "inline" }} /> Seating & QRs
        </button>
        <button onClick={() => setActiveTab("REFUNDS")} className={`tab-btn ${activeTab === "REFUNDS" ? "active" : ""}`}>
          <DollarSign size={13} style={{ marginRight: "3px", display: "inline" }} /> Refunds
        </button>
      </div>

      {/* TAB CONTENT: STATS */}
      {activeTab === "STATS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Key Metrics Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px" }}>
              <div style={{ background: "var(--success-light)", color: "var(--success)", padding: "10px", borderRadius: "10px" }}>
                <DollarSign size={20} />
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Total Revenue</span>
                <h3 style={{ fontSize: "18px", fontWeight: 800 }}>৳{totalSales.toFixed(2)}</h3>
              </div>
            </div>

            <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px" }}>
              <div style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "10px", borderRadius: "10px" }}>
                <ShoppingBag size={20} />
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Total Orders</span>
                <h3 style={{ fontSize: "18px", fontWeight: 800 }}>{totalOrdersCount}</h3>
              </div>
            </div>

            <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px" }}>
              <div style={{ background: "var(--info-light)", color: "var(--info)", padding: "10px", borderRadius: "10px" }}>
                <Activity size={20} />
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Avg Ticket Size</span>
                <h3 style={{ fontSize: "18px", fontWeight: 800 }}>৳{avgOrderValue.toFixed(2)}</h3>
              </div>
            </div>

            <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px" }}>
              <div style={{ background: "var(--warning-light)", color: "var(--warning)", padding: "10px", borderRadius: "10px" }}>
                <ChefHat size={20} />
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Cooking Now</span>
                <h3 style={{ fontSize: "18px", fontWeight: 800 }}>{activeOrdersCount}</h3>
              </div>
            </div>
          </div>

          {/* Key Metrics Row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px" }}>
              <div style={{ background: "rgba(99,102,241,0.06)", color: "#818cf8", padding: "10px", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.15)" }}>
                <TableIcon size={20} />
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Active Seating Tables</span>
                <h3 style={{ fontSize: "18px", fontWeight: 800 }}>{tablesList.filter(t => t.status === "ACTIVE").length} Tables</h3>
              </div>
            </div>

            <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px" }}>
              <div style={{ background: "rgba(239,68,68,0.06)", color: "#f87171", padding: "10px", borderRadius: "10px", border: "1px solid rgba(239,68,68,0.15)" }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Out of Stock / Low Items</span>
                <h3 style={{ fontSize: "18px", fontWeight: 800 }}>{itemsList.filter(i => i.status === "OUT_OF_STOCK" || (i.stock !== undefined ? i.stock : 50) <= 0).length} Items</h3>
              </div>
            </div>

            <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px" }}>
              <div style={{ background: "rgba(245,158,11,0.06)", color: "#fbbf24", padding: "10px", borderRadius: "10px", border: "1px solid rgba(245,158,11,0.15)" }}>
                <DollarSign size={20} />
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Pending Refund Requests</span>
                <h3 style={{ fontSize: "18px", fontWeight: 800 }}>{ordersList.filter(o => o.refundStatus === "ESCALATED").length} Pending</h3>
              </div>
            </div>
          </div>

          {/* Popularity Metrics */}
          <div className="glass-panel">
            <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Popular Food Items</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {popularItems.length > 0 ? (
                popularItems.map((item) => {
                  const percentage = (item.qty / maxQtySold) * 100;
                  return (
                    <div key={item.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                        <span style={{ color: "var(--text-secondary)" }}>{item.qty} sold</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.03)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            background: "var(--primary)",
                            borderRadius: "3px",
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>No sales data available yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MENU MANAGER */}
      {activeTab === "MENU" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Menu Form */}
          <div className="glass-panel" style={{ padding: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <PlusCircle size={16} style={{ color: "var(--primary)" }} />
              {editingItem ? `Edit: ${editingItem.name}` : "Add New Dish"}
            </h3>

            <form onSubmit={handleMenuSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Dish Name</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Garlic Bread"
                    value={menuForm.name}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Price (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field"
                    placeholder="e.g. 250"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, price: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    placeholder="e.g. 50"
                    value={menuForm.stock}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, stock: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Category</label>
                  <select
                    className="input-field"
                    value={menuForm.category}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, category: e.target.value }))}
                    style={{ background: "var(--bg-primary)" }}
                  >
                    <option value="APPETIZERS">Appetizers</option>
                    <option value="MAIN_COURSES">Main Courses</option>
                    <option value="DESSERTS">Desserts</option>
                    <option value="BEVERAGES">Beverages</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Emoji</label>
                  <select
                    className="input-field"
                    value={menuForm.image}
                    onChange={(e) => setMenuForm((prev) => ({ ...prev, image: e.target.value }))}
                    style={{ background: "var(--bg-primary)" }}
                  >
                    <option value="🍔">🍔 Burger</option>
                    <option value="🍛">🍛 Biryani</option>
                    <option value="🍚">🍚 Rice</option>
                    <option value="🍗">🍗 Chicken</option>
                    <option value="☕">☕ Tea/Coffee</option>
                    <option value="🥤">🥤 Cold Drink</option>
                    <option value="🍟">🍟 Fries</option>
                    <option value="🥪">🥪 Sandwich</option>
                    <option value="🥗">🥗 Salad</option>
                    <option value="🍰">🍰 Cake</option>
                    <option value="🍨">🍨 Ice Cream</option>
                    <option value="🍕">🍕 Pizza</option>
                    <option value="🍜">🍜 Noodles</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description</label>
                <textarea
                  className="input-field"
                  placeholder="Ingredients and serving details..."
                  rows={2}
                  value={menuForm.description}
                  onChange={(e) => setMenuForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
                {editingItem && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditingItem(null);
                      setMenuForm({
                        name: "",
                        description: "",
                        price: "",
                        image: "🍔",
                        category: "MAIN_COURSES",
                        status: "IN_STOCK",
                        stock: "50",
                      });
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={menuLoading} className="btn btn-primary btn-sm" style={{ minWidth: "100px" }}>
                  {menuLoading ? <Loader2 size={13} className="animate-spin" /> : editingItem ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>

          {/* Dishes Table */}
          <div className="glass-panel" style={{ overflowX: "auto", padding: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "10px" }}>Food Item</th>
                  <th style={{ padding: "10px" }}>Price</th>
                  <th style={{ padding: "10px" }}>Availability</th>
                  <th style={{ padding: "10px" }}>Stock Level</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {itemsList.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "22px" }}>{item.image}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)" }}>{item.category.replace("_", " ")}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>৳{item.price.toFixed(2)}</td>
                    <td style={{ padding: "10px" }}>
                      <button
                        onClick={() => handleToggleStockStatus(item)}
                        className={`badge ${item.status === "IN_STOCK" ? "badge-success" : "badge-danger"}`}
                        style={{ cursor: "pointer", border: "none", fontSize: "10px" }}
                      >
                        {item.status === "IN_STOCK" ? "In Stock" : "Out of Stock"}
                      </button>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontWeight: 600, color: (item.stock !== undefined ? item.stock : 50) <= 5 ? "#f87171" : "inherit" }}>
                        {item.stock !== undefined ? item.stock : 50} pieces
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button onClick={() => handleEditItemInit(item)} className="btn btn-secondary btn-icon btn-sm" style={{ width: "28px", height: "28px", borderRadius: "6px" }}>
                          <Edit2 size={11} />
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} className="btn btn-secondary btn-icon btn-sm" style={{ width: "28px", height: "28px", borderRadius: "6px", color: "var(--danger)" }}>
                          <Trash size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TABLES */}
      {activeTab === "TABLES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Add Table Form */}
          <div className="glass-panel" style={{ padding: "16px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>Create Seating Table</h3>
            <form onSubmit={handleCreateTable} style={{ display: "flex", gap: "10px", alignItems: "flex-end", maxWidth: "320px" }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Table Number</label>
                <input
                  type="number"
                  required
                  className="input-field"
                  placeholder="e.g. 6"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(e.target.value)}
                />
              </div>
              <button type="submit" disabled={tableLoading} className="btn btn-primary btn-sm" style={{ height: "42px" }}>
                {tableLoading ? <Loader2 size={13} className="animate-spin" /> : "Add"}
              </button>
            </form>
          </div>

          {/* Tables Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
            {tablesList.map((table) => (
              <div
                key={table.id}
                className="glass-panel"
                style={{
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  borderColor: table.status === "ACTIVE" ? "var(--primary-glow)" : "var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "18px", fontWeight: 800 }}>T-{table.number}</span>
                  <button
                    onClick={() => handleToggleTableStatus(table)}
                    className={`badge ${table.status === "ACTIVE" ? "badge-success" : "badge-danger"}`}
                    style={{ border: "none", cursor: "pointer", fontSize: "10px" }}
                  >
                    {table.status === "ACTIVE" ? "Open" : "Closed"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleOpenQR(table)} className="btn btn-secondary btn-sm" style={{ flex: 1, gap: "4px", fontSize: "12px", height: "32px" }}>
                    <QrCode size={12} /> QR Link
                  </button>
                  <button
                    onClick={() => handleDeleteTable(table)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: "0 10px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
                    title="Delete Table"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: REFUNDS & ESCALATIONS */}
      {activeTab === "REFUNDS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="glass-panel">
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Pending Refund Approvals</h3>
            
            {/* Escalated list */}
            {ordersList.filter(o => o.refundStatus === "ESCALATED").length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {ordersList.filter(o => o.refundStatus === "ESCALATED").map((order) => (
                  <div key={order.id} className="glass-panel" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "10px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <strong style={{ fontSize: "14px" }}>Order: {order.orderNumber}</strong>
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "10px" }}>Table {order.tableNumber} • {getElapsedTime(order.createdAt)}</span>
                      </div>
                      <span className="badge badge-warning" style={{ alignSelf: "flex-start" }}>Requires Review</span>
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      <strong>Items: </strong> {order.items.map(it => `${it.menuItemName} (x${it.quantity})`).join(", ")}
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      <strong>Kitchen Status: </strong>
                      <span className={`badge ${
                        order.status === "RECEIVED" ? "badge-info" :
                        order.status === "PREPARING" ? "badge-warning" :
                        order.status === "READY" ? "badge-success" :
                        order.status === "COMPLETED" ? "badge-success" : "badge-danger"
                      }`} style={{ display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                        {order.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "12px", color: "var(--text-primary)", background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", margin: "4px 0" }}>
                      <span>👤 <strong>{order.customerName || "Customer"}</strong></span>
                      <span style={{ color: "var(--text-muted)" }}>•</span>
                      <span style={{ color: "var(--text-secondary)" }}>{order.customerEmail || order.customerPhone || "No contact info"}</span>
                    </div>

                    <div style={{ padding: "8px 10px", background: "rgba(245, 158, 11, 0.05)", borderLeft: "3px solid var(--warning)", borderRadius: "4px", fontSize: "12px" }}>
                      <strong>Reason: </strong> {order.refundReason || "No details provided"}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "10px", marginTop: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700 }}>Total: ৳{order.total.toFixed(2)}</span>
                      
                      <div style={{ display: "flex", gap: "8px" }}>
                        {refundLoading === order.id ? (
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Processing...</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleResolveRefund(order.id, "REFUNDED")}
                              className="btn btn-primary btn-sm"
                              style={{ background: "var(--success)", border: "none" }}
                            >
                              Approve Refund
                            </button>
                            <button
                              onClick={() => handleResolveRefund(order.id, "REFUND_DENIED")}
                              className="btn btn-danger btn-sm"
                            >
                              Deny Refund
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>No refund requests require review currently.</p>
            )}
          </div>

          <div className="glass-panel">
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Resolved Refund Log</h3>
            {ordersList.filter(o => ["REFUNDED", "REFUND_DENIED"].includes(o.refundStatus || "")).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {ordersList.filter(o => ["REFUNDED", "REFUND_DENIED"].includes(o.refundStatus || "")).map((order) => (
                  <div key={order.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.01)", fontSize: "12px" }}>
                    <div>
                      <strong>{order.orderNumber}</strong> • Table {order.tableNumber} • ৳{order.total.toFixed(2)}
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        👤 {order.customerName || "Customer"} ({order.customerEmail || order.customerPhone || "No contact info"})
                      </span>
                      {order.refundReason && <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>Reason: "{order.refundReason}"</span>}
                    </div>
                    <span className={`badge ${order.refundStatus === "REFUNDED" ? "badge-success" : "badge-danger"}`} style={{ borderStyle: "dashed" }}>
                      {order.refundStatus}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>No resolved refund history found.</p>
            )}
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {qrModalTable && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="glass-panel animate-fade-in" style={{ width: "90%", maxWidth: "340px", padding: "24px", textAlign: "center", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700 }}>Table {qrModalTable.number} QR Link</h3>
              <button onClick={() => { setQrModalTable(null); setQrCodeUrl(""); }} className="btn btn-secondary btn-icon btn-sm" style={{ width: "30px", height: "30px" }}>
                <X size={14} />
              </button>
            </div>

            {/* QR Image */}
            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", display: "inline-block", marginBottom: "16px" }}>
              {qrCodeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCodeUrl} alt={`Table ${qrModalTable.number} QR`} style={{ display: "block", maxWidth: "200px", height: "auto" }} />
              ) : (
                <div style={{ width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}>
                  Generating...
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => window.print()} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                Print
              </button>
              <a href={qrCodeUrl} download={`CampusBite_Table_${qrModalTable.number}.png`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                <Download size={13} /> Download
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
