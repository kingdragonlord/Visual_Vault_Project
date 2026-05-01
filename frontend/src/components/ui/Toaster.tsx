"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

function SingleToast({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const styles: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", icon: "✓" },
    error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", icon: "✕" },
    info: { bg: "rgba(6,182,212,0.15)", border: "rgba(6,182,212,0.3)", icon: "i" },
  };
  const s = styles[item.type];

  return (
    <div
      onClick={onRemove}
      className="flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer select-none"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        backdropFilter: "blur(16px)",
        color: "var(--text-primary)",
        fontSize: "14px",
        fontWeight: 500,
        maxWidth: 360,
        minWidth: 240,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        animation: "slideIn 0.3s ease",
      }}
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{ background: s.border }}
      >
        {s.icon}
      </span>
      <span>{item.message}</span>
    </div>
  );
}

// Toaster acts as both the context provider AND the toast renderer
export function Toaster({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-6 right-6 flex flex-col gap-3 z-50"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <SingleToast key={t.id} item={t} onRemove={() => remove(t.id)} />
        ))}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
