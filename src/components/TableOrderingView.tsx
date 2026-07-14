"use client";

import { useState, useEffect, useRef } from "react";
import { MenuItem, OrderItem } from "@/lib/mockDb";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { SessionUser } from "@/lib/session";
import { createOrderAction, getCustomerOrdersAction } from "@/app/actions";
import {
  Search,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  ClipboardList,
} from "lucide-react";

interface Props {
  tableNumber: number;
  menuItems: MenuItem[];
  session: SessionUser | null;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

// Helper to parse double-star markdown for bold text rendering in React
const renderFormattedText = (text: string) => {
  if (!text) return "";
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: "var(--text-primary)" }}>
          {part}
        </strong>
      );
    }
    return part;
  });
};

// Interactive card displayed in chat list when AI recommends a menu dish
function ChatRecommendCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAdd();
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      style={{
        flex: "0 0 250px",
        padding: "10px 12px",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "20px" }}>{item.image || "🍔"}</span>
        <div style={{ textAlign: "left" }}>
          <strong style={{ fontSize: "12px", display: "block", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "130px" }} title={item.name}>{item.name}</strong>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>৳{item.price.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={handleAdd}
        disabled={added}
        className="btn btn-primary"
        style={{
          padding: "6px 8px",
          borderRadius: "8px",
          fontSize: "11px",
          background: added ? "var(--success)" : "var(--primary)",
          transition: "var(--transition)",
          minWidth: "72px",
          height: "28px",
          lineHeight: 1,
        }}
      >
        {added ? "Added!" : "Order"}
      </button>
    </div>
  );
}

export default function TableOrderingView({ tableNumber, menuItems, session }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Checkout Info
  const [customerName, setCustomerName] = useState(session?.name || "");
  const [customerContact, setCustomerContact] = useState(session?.email || session?.phone || "");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  
  // Past Orders History
  const [pastOrders, setPastOrders] = useState<any[]>([]);

  // Chatbot State
  const [chatSessionId, setChatSessionId] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([
    { role: "model", content: `Hello! I'm your CampusBite AI Chef. I see you are at Table ${tableNumber}. How can I assist you today? Tap a quick question below!` }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load orders history from database
  const loadPastOrders = async () => {
    try {
      const res = await getCustomerOrdersAction();
      if (res.success && res.orders) {
        setPastOrders(res.orders);
        
        // Find the most recent active order (where status is RECEIVED, PREPARING, or READY)
        const active = res.orders.filter(
          (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED"
        );
        if (active.length > 0) {
          // Sort by date desc (most recent first)
          active.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setPlacedOrder(active[0]);
        } else {
          setPlacedOrder(null);
        }
      }
    } catch (e) {
      console.error("Failed loading order history from db", e);
    }
  };

  // Redirect to login if session is not set (client-side backup check)
  useEffect(() => {
    if (!session) {
      window.location.href = `/login?redirectTo=/table/${tableNumber}`;
    }
  }, [session, tableNumber]);

  // Initialize unique chat session ID and load past orders
  useEffect(() => {
    setChatSessionId("session-" + Math.random().toString(36).substring(2, 9));
    loadPastOrders();
  }, [tableNumber]);

  // Automatically poll status of active order every 5 seconds
  useEffect(() => {
    if (!placedOrder || placedOrder.status === "COMPLETED" || placedOrder.status === "CANCELLED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/order-status?id=${placedOrder.id}`);
        if (res.ok) {
          const updated = await res.json();
          if (updated.status !== placedOrder.status) {
            setPlacedOrder(updated);
            // Sync status inside history list
            setPastOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o)));
            toast(`Order ${updated.orderNumber} is now: ${updated.status.toLowerCase()}`, "info");
          }
        }
      } catch (e) {
        console.error("Failed to auto-poll active order status", e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [placedOrder]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatLoading, isChatOpen]);

  // Filter categories
  const categories = ["ALL", "APPETIZERS", "MAIN_COURSES", "DESSERTS", "BEVERAGES"];

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart operations
  const addToCart = (item: MenuItem) => {
    if (item.status === "OUT_OF_STOCK") return;
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) => (i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { item, quantity: 1 }];
    });
    toast(`Added ${item.name} to basket!`, "success");
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((i) => (i.item.id === itemId ? { ...i, quantity: i.quantity - 1 } : i));
      }
      return prev.filter((i) => i.item.id !== itemId);
    });
    toast("Removed item from basket", "info");
  };

  const cartTotal = cart.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);
  const cartItemCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  // Submit Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    
    setOrderSubmitting(true);
    try {
      const orderItems = cart.map((i) => ({
        menuItemId: i.item.id,
        menuItemName: i.item.name,
        price: i.item.price,
        quantity: i.quantity,
      }));

      const res = await createOrderAction({
        tableNumber,
        specialInstructions,
        items: orderItems,
      });

      if (res.success && res.order) {
        setPlacedOrder(res.order);
        setCart([]);
        setSpecialInstructions("");
        setIsCartOpen(false);
        await loadPastOrders();
        toast(`Order ${res.order.orderNumber} sent to kitchen successfully!`, "success");
        router.refresh();
      } else {
        toast(res.error || "Failed to place order. Please try again.", "error");
      }
    } catch (err) {
      console.error(err);
      alert("Error placing order. Please try again.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Poll order status
  const handleRefreshOrderStatus = async () => {
    if (!placedOrder) return;
    try {
      const res = await fetch(`/api/order-status?id=${placedOrder.id}`);
      if (res.ok) {
        const updated = await res.json();
        setPlacedOrder(updated);
        await loadPastOrders();
      }
    } catch (e) {
      console.error("Failed to check status", e);
    }
  };

  const handleRefreshPastOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/order-status?id=${orderId}`);
      if (res.ok) {
        const updated = await res.json();
        setPastOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        
        // If this is the active order, update it too
        if (placedOrder && placedOrder.id === orderId) {
          setPlacedOrder(updated);
        }
      }
    } catch (e) {
      console.error("Failed refreshing history order", e);
    }
  };

  // Clear active order tracking
  const handleClearOrderTracking = () => {
    setPlacedOrder(null);
  };

  // Direct instant ordering from recommended cards inside the chat bubble
  const handleDirectOrder = async (itemId: string, itemName: string, price: number) => {
    setChatLoading(true);
    try {
      const res = await createOrderAction({
        tableNumber,
        specialInstructions: "",
        items: [{
          menuItemId: itemId,
          menuItemName: itemName,
          price: price,
          quantity: 1
        }]
      });

      if (res.success && res.order) {
        setPlacedOrder(res.order);
        setCart([]); // Clear cart
        setIsChatOpen(false); // Close chat drawer
        setIsCartOpen(false); // Close cart drawer
        await loadPastOrders();
        toast(`Direct order placed for ${itemName}!`, "success");
        router.refresh();
      } else {
        toast(res.error || "Failed to place order. Please try again.", "error");
      }
    } catch (err) {
      console.error("Direct order execution error:", err);
      alert("Error placing order. Please try again.");
    } finally {
      setChatLoading(false);
    }
  };

  // Chat API call
  const sendChatMessage = async (text: string) => {
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: chatSessionId,
          tableNumber,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [...prev, { role: "model", content: data.text }]);
        
        // Direct ordering integration: if chatbot ordered directly in database
        if (data.orderPlaced && data.order) {
          setPlacedOrder(data.order);
          setCart([]);
          setIsChatOpen(false); // Automatically close chat side-drawer
          setIsCartOpen(false); // Automatically close cart drawer
          await loadPastOrders();
          router.refresh();
        }

        // Direct refund or escalation updates
        if (data.orderUpdated && data.order) {
          setPlacedOrder(data.order);
          await loadPastOrders();
        }
      } else {
        setChatMessages((prev) => [...prev, { role: "model", content: "I had trouble processing that. Please try again." }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "model", content: "System connection error. Please verify network." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userText }]);
    await sendChatMessage(userText);
  };

  const handleQuickQuestion = async (text: string) => {
    if (chatLoading) return;
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    await sendChatMessage(text);
  };

  // Parse [RECOMMEND: id1, id2] from chat content
  const parseRecommendIds = (content: string) => {
    const match = content.match(/\[RECOMMEND:\s*([^\]]+)\]/);
    if (!match) return { cleanText: content, ids: [] as string[] };
    
    const cleanText = content.replace(/\[RECOMMEND:\s*([^\]]+)\]/, "").trim();
    const ids = match[1].split(",").map((id) => id.trim());
    return { cleanText, ids };
  };

  // Order status progress calculation
  const getStepProgressWidth = (status: string) => {
    if (status === "RECEIVED") return "0%";
    if (status === "PREPARING") return "50%";
    if (status === "READY") return "100%";
    if (status === "COMPLETED") return "100%";
    return "0%";
  };

  return (
    <div className="app-container" style={{ paddingBottom: "160px", position: "relative" }}>
      
      {/* Table Welcome Indicator & History Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Table {tableNumber}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Browse menu and tap items to order.</p>
        </div>
        
        {/* Past Orders Portal Trigger */}
        <button
          onClick={() => {
            loadPastOrders();
            setIsHistoryOpen(true);
          }}
          className="btn btn-secondary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", fontSize: "12px" }}
        >
          <ClipboardList size={14} style={{ color: "var(--primary)" }} />
          <span>My Orders ({pastOrders.length})</span>
        </button>
      </div>

      {/* Active Order Tracker */}
      {placedOrder && (
        <div className="glass-panel animate-fade-in" style={{ marginBottom: "20px", background: "var(--bg-secondary)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                ACTIVE ORDER {placedOrder.orderNumber}
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={handleRefreshOrderStatus} className="btn btn-secondary btn-icon btn-sm" style={{ width: "30px", height: "30px", borderRadius: "8px" }} title="Update Status">
                <RefreshCw size={12} />
              </button>
              {(placedOrder.status === "COMPLETED" || placedOrder.status === "CANCELLED" || placedOrder.refundStatus === "REFUNDED" || placedOrder.refundStatus === "REFUND_DENIED") && (
                <button onClick={handleClearOrderTracking} className="btn btn-secondary btn-icon btn-sm" style={{ width: "30px", height: "30px", borderRadius: "8px" }}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {placedOrder.refundStatus ? (
            <div style={{ padding: "0 10px 14px 10px" }}>
              {placedOrder.refundStatus === "REFUNDED" && (
                <div style={{ background: "var(--success-light)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "var(--radius-md)", padding: "14px", textAlign: "center" }}>
                  <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>💸</span>
                  <strong style={{ color: "var(--success)", fontSize: "13px", display: "block" }}>Order Refunded Successfully</strong>
                  <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>
                    ৳{placedOrder.refundAmount?.toFixed(2)} has been credited back to your account.
                  </p>
                  {placedOrder.refundReason && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "6px", fontStyle: "italic" }}>
                      Reason: {placedOrder.refundReason}
                    </span>
                  )}
                </div>
              )}
              {placedOrder.refundStatus === "ESCALATED" && (
                <div style={{ background: "var(--warning-light)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "var(--radius-md)", padding: "14px", textAlign: "center" }} className="animate-pulse-light">
                  <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>⏳</span>
                  <strong style={{ color: "var(--warning)", fontSize: "13px", display: "block" }}>Escalated to Human Review</strong>
                  <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>
                    A manager is reviewing your refund request. We will update you shortly.
                  </p>
                  {placedOrder.refundReason && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "6px", fontStyle: "italic" }}>
                      Reason: {placedOrder.refundReason}
                    </span>
                  )}
                </div>
              )}
              {placedOrder.refundStatus === "REFUND_DENIED" && (
                <div style={{ background: "var(--danger-light)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "var(--radius-md)", padding: "14px", textAlign: "center" }}>
                  <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>❌</span>
                  <strong style={{ color: "var(--danger)", fontSize: "13px", display: "block" }}>Refund Request Denied</strong>
                  <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>
                    Our support manager reviewed your request and was unable to approve a refund at this time.
                  </p>
                </div>
              )}
            </div>
          ) : placedOrder.status !== "CANCELLED" ? (
            <div style={{ padding: "0 10px 24px 10px" }}>
              <div className="order-steps">
                <div className="order-steps-progress" style={{ width: getStepProgressWidth(placedOrder.status) }}></div>
                <div className="step-node completed">
                  <span className="step-label">Received</span>
                </div>
                <div className={`step-node ${["PREPARING", "READY", "COMPLETED"].includes(placedOrder.status) ? (placedOrder.status === "PREPARING" ? "active" : "completed") : ""}`}>
                  <span className="step-label">Cooking</span>
                </div>
                <div className={`step-node ${["READY", "COMPLETED"].includes(placedOrder.status) ? (placedOrder.status === "READY" ? "active" : "completed") : ""}`}>
                  <span className="step-label">Ready</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "10px", color: "var(--danger)", fontSize: "13px", fontWeight: 600 }}>
              Order was cancelled.
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search food..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: "36px" }}
          />
          <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        </div>

        {/* Category horizontal scroll */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px", scrollbarWidth: "none" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="tab-btn"
              style={{
                whiteSpace: "nowrap",
                padding: "8px 12px",
                flex: "none",
                background: selectedCategory === cat ? "var(--surface)" : "transparent",
                color: selectedCategory === cat ? "var(--text-primary)" : "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
                border: selectedCategory === cat ? "1px solid var(--border)" : "1px solid transparent",
                fontSize: "12px",
              }}
            >
              {cat.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Menu List */}
      <div className="items-grid">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <div key={item.id} className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "10px", opacity: item.status === "OUT_OF_STOCK" ? 0.5 : 1 }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "28px", padding: "6px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "10px", flexShrink: 0 }}>
                  {item.image || "🍔"}
                </span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600 }}>{item.name}</h3>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px", lineHeight: "1.3" }}>
                    {item.description}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                <span style={{ fontWeight: 700, fontSize: "14px" }}>
                  ৳{item.price.toFixed(2)}
                </span>
                {item.status === "OUT_OF_STOCK" ? (
                  <span style={{ fontSize: "11px", color: "var(--danger)", fontWeight: 500 }}>Out of Stock</span>
                ) : (
                  <button
                    onClick={() => addToCart(item)}
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: "8px", padding: "6px 12px" }}
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-secondary)", fontSize: "13px" }}>
            No food items found.
          </div>
        )}
      </div>

      {/* Bottom Sticky Unified Control Bar */}
      <div
        style={{
          position: "fixed",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "95%",
          maxWidth: "480px",
          height: "54px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "27px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          gap: "8px",
          zIndex: 90,
          boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
        }}
      >
        {/* Ask AI Chef Button */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="btn btn-secondary"
            style={{
              flex: "1 1 35%",
              borderRadius: "22px",
              height: "38px",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
            }}
          >
            <Sparkles size={14} style={{ color: "var(--primary)" }} />
            <span>Ask AI</span>
          </button>
        )}

        {/* View Basket Button */}
        <button
          onClick={() => cartItemCount > 0 && setIsCartOpen(true)}
          disabled={cartItemCount === 0}
          className="btn btn-primary"
          style={{
            flex: isChatOpen ? "1 1 100%" : "1 1 65%",
            borderRadius: "22px",
            height: "38px",
            fontSize: "12px",
            opacity: cartItemCount === 0 ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <ShoppingCart size={14} />
          <span>Basket ({cartItemCount}) • ৳{cartTotal.toFixed(0)}</span>
        </button>
      </div>

      {/* PAST ORDERS HISTORY MODAL */}
      {isHistoryOpen && (
        <div className="drawer-overlay">
          <div className="drawer-content animate-slide-up" style={{ maxHeight: "80vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ClipboardList size={18} style={{ color: "var(--primary)" }} />
                <h2 style={{ fontSize: "16px", fontWeight: 700 }}>My Orders History</h2>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="btn btn-secondary btn-icon btn-sm" style={{ width: "30px", height: "30px" }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {pastOrders.length > 0 ? (
                pastOrders.map((order) => (
                  <div key={order.id} style={{ padding: "12px", background: "rgba(255, 255, 255, 0.01)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700 }}>Order: {order.orderNumber}</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span className={`badge ${
                          order.status === "RECEIVED" ? "badge-info" :
                          order.status === "PREPARING" ? "badge-warning" :
                          order.status === "READY" ? "badge-success" :
                          order.status === "COMPLETED" ? "badge-success" : "badge-danger"
                        }`}>
                          {order.status}
                        </span>
                        {order.refundStatus && (
                          <span className={`badge ${
                            order.refundStatus === "REFUNDED" ? "badge-success" :
                            order.refundStatus === "ESCALATED" ? "badge-warning" : "badge-danger"
                          }`} style={{ borderStyle: "dashed" }}>
                            {order.refundStatus === "REFUNDED" ? `REFUNDED (৳${(order.refundAmount || order.total).toFixed(0)})` : order.refundStatus}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ margin: "6px 0", padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {order.items && order.items.map((it: OrderItem) => (
                          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                            <span style={{ color: "var(--text-primary)" }}>{it.quantity}x {it.menuItemName}</span>
                            <span style={{ color: "var(--text-secondary)" }}>৳{(it.price * it.quantity).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "6px", marginTop: "6px" }}>
                      <span>Table {order.tableNumber} • Total: <strong>৳{order.total.toFixed(2)}</strong></span>
                      
                      <button
                        onClick={() => handleRefreshPastOrder(order.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ height: "24px", padding: "0 8px", fontSize: "10px", borderRadius: "4px" }}
                      >
                        <RefreshCw size={10} /> Refresh
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-secondary)", fontSize: "13px" }}>
                  You haven't placed any orders yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CART DRAWER MODAL */}
      {isCartOpen && (
        <div className="drawer-overlay">
          <div className="drawer-content animate-slide-up" style={{ maxHeight: "85vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Your Selected Food</h2>
              <button onClick={() => setIsCartOpen(false)} className="btn btn-secondary btn-icon btn-sm" style={{ width: "30px", height: "30px" }}>
                <X size={14} />
              </button>
            </div>

            {/* Cart Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              {cart.map((cartItem) => (
                <div key={cartItem.item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.01)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                  <div>
                    <h4 style={{ fontSize: "13px", fontWeight: 600 }}>{cartItem.item.name}</h4>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      ৳{cartItem.item.price.toFixed(2)} x {cartItem.quantity}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => removeFromCart(cartItem.item.id)} className="btn btn-secondary btn-icon btn-sm" style={{ width: "26px", height: "26px" }}>
                      <Minus size={10} />
                    </button>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{cartItem.quantity}</span>
                    <button onClick={() => addToCart(cartItem.item)} className="btn btn-secondary btn-icon btn-sm" style={{ width: "26px", height: "26px" }}>
                      <Plus size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Special Instructions */}
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label className="form-label">Special Cooking instructions</label>
              <textarea
                className="input-field"
                placeholder="e.g. no onions, extra spicy, allergic to dairy..."
                rows={2}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                style={{ resize: "none" }}
              />
            </div>

            {/* Checkout Form */}
            <form onSubmit={handlePlaceOrder} style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>Total Price</span>
                <span style={{ fontWeight: 800, fontSize: "16px" }}>৳{cartTotal.toFixed(2)}</span>
              </div>

              {!session && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="Your Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="Phone or Email"
                    value={customerContact}
                    onChange={(e) => setCustomerContact(e.target.value)}
                  />
                </div>
              )}

              <button type="submit" disabled={orderSubmitting} className="btn btn-primary" style={{ width: "100%", height: "42px" }}>
                {orderSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Cooking...
                  </>
                ) : (
                  <>
                    Send Order to Kitchen (৳{cartTotal.toFixed(2)})
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI CHATBOT SIDE SHEET */}
      {isChatOpen && (
        <div className="chat-drawer-overlay">
          <div className="chat-drawer-content animate-slide-up">
            
            {/* Chat Header */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={16} style={{ color: "var(--primary)" }} />
                <h3 style={{ fontSize: "14px", fontWeight: 600 }}>CampusBite AI Chef</h3>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="btn btn-secondary btn-icon btn-sm" style={{ width: "30px", height: "30px" }}>
                <X size={14} />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="chat-messages" style={{ padding: "16px" }}>
              {chatMessages.map((msg, i) => {
                const { cleanText, ids } = parseRecommendIds(msg.content);
                const isUser = msg.role === "user";
                
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                      width: "100%",
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      marginBottom: "4px"
                    }}
                  >
                    {!isUser && (
                      <div className="chat-avatar chat-avatar-ai" title="AI Chef">👨‍🍳</div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        maxWidth: "80%",
                        alignItems: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        className={`chat-bubble ${isUser ? "chat-bubble-user" : "chat-bubble-ai"}`}
                        style={{ width: "fit-content", whiteSpace: "pre-line" }}
                      >
                        {renderFormattedText(cleanText)}
                      </div>

                      {/* Interactive Recommended Food Cards (Order directly from chat bubble) */}
                      {!isUser && ids.length > 0 && (
                        <div style={{ display: "flex", gap: "8px", overflowX: "auto", width: "100%", maxWidth: "100%", paddingBottom: "6px", scrollbarWidth: "none", marginTop: "4px" }}>
                          {ids.map((id) => {
                            const item = menuItems.find((it) => it.id === id);
                            if (!item || item.status === "OUT_OF_STOCK") return null;
                            return (
                              <ChatRecommendCard
                                key={item.id}
                                item={item}
                                onAdd={() => handleDirectOrder(item.id, item.name, item.price)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="chat-avatar chat-avatar-user" title="You">🎓</div>
                    )}
                  </div>
                );
              })}
              {chatLoading && (
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", width: "100%", alignSelf: "flex-start", marginBottom: "4px" }}>
                  <div className="chat-avatar chat-avatar-ai">👨‍🍳</div>
                  <div className="chat-bubble chat-bubble-ai" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Loader2 size={12} className="animate-spin" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={chatBottomRef}></div>
            </div>

            {/* AI Suggestion Chips for Easy Tap-Ordering */}
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "8px 16px", background: "rgba(0,0,0,0.1)", borderTop: "1px solid var(--border)", scrollbarWidth: "none" }}>
              <button
                type="button"
                onClick={() => handleQuickQuestion("Recommend a food item")}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "11px", padding: "6px 12px", whiteSpace: "nowrap" }}
              >
                Recommend food item
              </button>
              <button
                type="button"
                onClick={() => handleQuickQuestion("What drinks are in stock?")}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "11px", padding: "6px 12px", whiteSpace: "nowrap" }}
              >
                What drinks are in stock?
              </button>
              <button
                type="button"
                onClick={() => handleQuickQuestion("Is there any Biryani?")}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "11px", padding: "6px 12px", whiteSpace: "nowrap" }}
              >
                Is there any Biryani?
              </button>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="chat-input-area" style={{ padding: "12px 16px" }}>
              <input
                type="text"
                className="input-field"
                placeholder="Ask AI about cafeteria menu..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <button type="submit" disabled={!chatInput.trim() || chatLoading} className="btn btn-primary btn-icon" style={{ flexShrink: 0, width: "36px", height: "36px" }}>
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
