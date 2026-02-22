import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastTone = "neutral" | "success" | "danger";

type ToastPayload = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const pushToast = useCallback((message: string, tone: ToastTone = "neutral") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4">
        {toast ? (
          <output
            key={toast.id}
            role="status"
            aria-live="polite"
            className={cn(
              "fade-enter rounded-pill border px-4 py-2 text-small",
              toast.tone === "neutral" && "surface",
              toast.tone === "success" && "border-[var(--color-success)]/35 bg-[var(--color-success)]/15",
              toast.tone === "danger" && "border-[var(--color-danger)]/35 bg-[var(--color-danger)]/15"
            )}
          >
            {toast.message}
          </output>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}
