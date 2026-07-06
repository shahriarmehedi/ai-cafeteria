"use client";

import { useState, useEffect } from "react";
import { Order } from "@/lib/mockDb";
import { SessionUser } from "@/lib/session";
import { updateOrderStatusAction, resolveEscalationAction } from "@/app/actions";
import {
  Clock,
  RefreshCw,
  X,
  Loader2,
  Check,
  Play,
  CheckCircle2,
} from "lucide-react";

interface Props {
  initialOrders: Order[];
  session: SessionUser;
}

export default function KitchenDashboardView({ initialOrders, session }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ARCHIVE">("ACTIVE");
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Interactive checklist state for chefs to check off items as they prepare them
  const [completedItemIds, setCompletedItemIds] = useState<Record<string, boolean>>({});

  const toggleItemCheck = (itemId: string) => {
    setCompletedItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const playNewOrderBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain1.gain.setValueAtTime(0.04, audioCtx.currentTime);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.12);
      
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime); // A5
        gain2.gain.setValueAtTime(0.04, audioCtx.currentTime);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.22);
      }, 120);
    } catch {
      // Ignored if browser blocks
    }
  };

  const fetchOrders = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        
        // Audio notification on new incoming active orders
        const currentActiveIds = new Set(orders.filter(o => ["RECEIVED", "PREPARING", "READY"].includes(o.status)).map(o => o.id));
        const newActiveOrders = data.filter((o: Order) => ["RECEIVED", "PREPARING", "READY"].includes(o.status) && !currentActiveIds.has(o.id));
        
        if (newActiveOrders.length > 0 && orders.length > 0) {
          playNewOrderBeep();
        }

        setOrders(data);
      }
    } catch (e) {
      console.error("Failed syncing orders:", e);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  // Poll orders
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrders(true);
    }, 7000);
    return () => clearInterval(timer);
  }, [orders]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setActionLoading(orderId);
    try {
      const res = await updateOrderStatusAction(orderId, newStatus);
      if (res.error) {
        alert(res.error);
      } else {
        await fetchOrders(true);
      }
    } catch (err) {
      console.error(err);
      alert("Failed updating order.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveEscalation = async (orderId: string, resolution: "REFUNDED" | "REFUND_DENIED") => {
    setActionLoading(orderId);
    try {
      const res = await resolveEscalationAction(orderId, resolution);
      if (res.error) {
        alert(res.error);
      } else {
        await fetchOrders(true);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to resolve escalation.");
    } finally {
      setActionLoading(null);
    }
  };

  const activeOrders = orders.filter((o) => ["RECEIVED", "PREPARING", "READY"].includes(o.status));
  const archivedOrders = orders.filter((o) => ["COMPLETED", "CANCELLED"].includes(o.status));
  const displayOrders = activeTab === "ACTIVE" ? activeOrders : archivedOrders;

  const getElapsedTime = (createdAt: Date) => {
    const mins = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
    return mins < 1 ? "Just now" : `${mins}m ago`;
  };

  return (
    <div className="desktop-container animate-fade-in" style={{ paddingBottom: "40px" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Kitchen Queue</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Manage food tickets in real-time.</p>
        </div>
        
        <button onClick={() => fetchOrders(false)} disabled={refreshing} className="btn btn-secondary btn-sm" style={{ height: "36px" }}>
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          <span>Sync</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs-header" style={{ maxWidth: "320px", marginBottom: "24px" }}>
        <button onClick={() => setActiveTab("ACTIVE")} className={`tab-btn ${activeTab === "ACTIVE" ? "active" : ""}`}>
          Active Orders ({activeOrders.length})
        </button>
        <button onClick={() => setActiveTab("ARCHIVE")} className={`tab-btn ${activeTab === "ARCHIVE" ? "active" : ""}`}>
          Archive ({archivedOrders.length})
        </button>
      </div>

      {/* Ticket Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
        {displayOrders.length > 0 ? (
          displayOrders.map((order) => {
            const isLate = activeTab === "ACTIVE" && (new Date().getTime() - new Date(order.createdAt).getTime() > 15 * 60 * 1000);
            
            return (
              <div
                key={order.id}
                className="glass-panel"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "16px",
                  gap: "12px",
                  borderColor: isLate ? "rgba(239, 68, 68, 0.4)" : "var(--border)",
                  borderTop: `3px solid ${
                    order.status === "RECEIVED" ? "var(--primary)" :
                    order.status === "PREPARING" ? "var(--warning)" :
                    order.status === "READY" ? "var(--success)" : "var(--text-muted)"
                  }`,
                }}
              >
                <div>
                  {/* Top line with cancel */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 800 }}>Table {order.tableNumber}</span>
                    {["RECEIVED", "PREPARING"].includes(order.status) && (
                      <button
                        onClick={() => {
                          if (confirm(`Cancel order ${order.orderNumber}?`)) handleUpdateStatus(order.id, "CANCELLED");
                        }}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                        title="Cancel Order"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
                    <span>ID: {order.orderNumber}</span>
                    <span>•</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "2px", color: isLate ? "var(--danger)" : "var(--text-muted)", fontWeight: isLate ? 600 : "normal" }}>
                      <Clock size={11} /> {getElapsedTime(order.createdAt)}
                    </span>
                  </div>

                  {order.refundStatus && (
                    <div
                      style={{
                        background:
                          order.refundStatus === "REFUNDED" ? "var(--success-light)" :
                          order.refundStatus === "ESCALATED" ? "var(--warning-light)" : "var(--danger-light)",
                        border: `1px solid ${
                          order.refundStatus === "REFUNDED" ? "rgba(16, 185, 129, 0.2)" :
                          order.refundStatus === "ESCALATED" ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)"
                        }`,
                        color:
                          order.refundStatus === "REFUNDED" ? "var(--success)" :
                          order.refundStatus === "ESCALATED" ? "var(--warning)" : "var(--danger)",
                        borderRadius: "8px",
                        padding: "8px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        marginBottom: "10px",
                        textAlign: "center",
                      }}
                      className={order.refundStatus === "ESCALATED" ? "animate-pulse-light" : ""}
                    >
                      {order.refundStatus === "REFUNDED" && `💸 Refunded: ৳${order.refundAmount?.toFixed(2)}`}
                      {order.refundStatus === "ESCALATED" && `⚠️ Escalated: Human Review`}
                      {order.refundStatus === "REFUND_DENIED" && `❌ Refund Request Denied`}
                      {order.refundReason && (
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "normal", marginTop: "2px", fontStyle: "italic" }}>
                          "{order.refundReason}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Checklist of Items */}
                  <div style={{ borderTop: "1px dashed var(--border)", borderBottom: "1px dashed var(--border)", padding: "10px 0", margin: "10px 0" }}>
                    <p style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "6px" }}>
                      Chef Checklist (tap to cross out)
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleItemCheck(item.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "13px",
                            cursor: "pointer",
                            userSelect: "none",
                            textDecoration: completedItemIds[item.id] ? "line-through" : "none",
                            color: completedItemIds[item.id] ? "var(--text-muted)" : "var(--text-primary)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!completedItemIds[item.id]}
                            readOnly
                            style={{ accentColor: "var(--primary)", pointerEvents: "none" }}
                          />
                          <span>{item.quantity}x {item.menuItemName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Special Cooking Details */}
                  {order.specialInstructions && (
                    <div style={{ background: "var(--warning-light)", borderRadius: "8px", padding: "8px 10px", fontSize: "12px", border: "1px solid rgba(245, 158, 11, 0.1)" }}>
                      <strong style={{ color: "var(--warning)" }}>Notes: </strong>
                      <span style={{ color: "var(--text-primary)" }}>{order.specialInstructions}</span>
                    </div>
                  )}
                </div>

                {/* Ticket Single Main Action Button */}
                <div style={{ marginTop: "8px" }}>
                  {actionLoading === order.id ? (
                    <button disabled className="btn btn-secondary btn-sm" style={{ width: "100%" }}>
                      <Loader2 size={13} className="animate-spin" /> Updating...
                    </button>
                  ) : (
                    <>
                      {order.refundStatus === "ESCALATED" ? (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleResolveEscalation(order.id, "REFUNDED")}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1, background: "var(--success)", fontSize: "11px", padding: "6px" }}
                          >
                            Approve Refund
                          </button>
                          <button
                            onClick={() => handleResolveEscalation(order.id, "REFUND_DENIED")}
                            className="btn btn-danger btn-sm"
                            style={{ flex: 1, fontSize: "11px", padding: "6px" }}
                          >
                            Deny Refund
                          </button>
                        </div>
                      ) : (
                        <>
                          {order.status === "RECEIVED" && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                              className="btn btn-primary btn-sm"
                              style={{ width: "100%", background: "var(--primary)" }}
                            >
                              <Play size={12} /> Start Cooking
                            </button>
                          )}
                          {order.status === "PREPARING" && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, "READY")}
                              className="btn btn-primary btn-sm"
                              style={{ width: "100%", background: "var(--warning)", color: "#000" }}
                            >
                              <Check size={12} /> Mark as Ready
                            </button>
                          )}
                          {order.status === "READY" && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                              className="btn btn-primary btn-sm"
                              style={{ width: "100%", background: "var(--success)" }}
                            >
                              <CheckCircle2 size={12} /> Picked Up
                            </button>
                          )}
                          {activeTab === "ARCHIVE" && (
                            <div style={{ textAlign: "center", fontSize: "11px", color: order.status === "COMPLETED" ? "var(--success)" : "var(--danger)" }}>
                              Order {order.status.toLowerCase()}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>

              </div>
            );
          })
        ) : (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-secondary)" }} className="glass-panel">
            <span style={{ fontSize: "32px" }}>📋</span>
            <h3 style={{ fontSize: "15px", fontWeight: 600, marginTop: "10px" }}>No orders in this section</h3>
          </div>
        )}
      </div>

    </div>
  );
}
