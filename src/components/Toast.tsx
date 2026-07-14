"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      
      {/* Visual Toast Notification Overlay */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          let bg = "#18181b";
          let border = "1px solid rgba(255,255,255,0.08)";
          let color = "#f4f4f5";
          let emoji = "ℹ️";

          if (t.type === "success") {
            border = "1px solid rgba(16, 185, 129, 0.3)";
            color = "#34d399";
            emoji = "✅";
          } else if (t.type === "error") {
            border = "1px solid rgba(239, 68, 68, 0.3)";
            color = "#f87171";
            emoji = "❌";
          } else if (t.type === "warning") {
            border = "1px solid rgba(245, 158, 11, 0.3)";
            color = "#fbbf24";
            emoji = "⚠️";
          }

          return (
            <div
              key={t.id}
              className="animate-fade-in"
              style={{
                pointerEvents: "auto",
                background: bg,
                border,
                color,
                padding: "12px 18px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                minWidth: "240px",
                maxWidth: "360px",
                backdropFilter: "blur(8px)",
              }}
            >
              <span style={{ fontSize: "15px" }}>{emoji}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
