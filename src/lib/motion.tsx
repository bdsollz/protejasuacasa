import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type MotionPreference = "system" | "reduce" | "no-preference";

type MotionContextValue = {
  preference: MotionPreference;
  setPreference: (next: MotionPreference) => void;
  shouldReduceMotion: boolean;
};

const MOTION_KEY = "psc.motion";
const MotionContext = createContext<MotionContextValue | null>(null);

function getStoredMotion(): MotionPreference {
  const saved = localStorage.getItem(MOTION_KEY);
  if (saved === "reduce" || saved === "no-preference" || saved === "system") {
    return saved;
  }
  return "system";
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<MotionPreference>(() => getStoredMotion());
  const [systemReduce, setSystemReduce] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setSystemReduce(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const shouldReduceMotion = preference === "reduce" || (preference === "system" && systemReduce);

  useEffect(() => {
    localStorage.setItem(MOTION_KEY, preference);
    document.documentElement.dataset.motion = shouldReduceMotion ? "reduce" : "normal";
  }, [preference, shouldReduceMotion]);

  const value = useMemo(
    () => ({ preference, setPreference, shouldReduceMotion }),
    [preference, shouldReduceMotion]
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotionPreference() {
  const ctx = useContext(MotionContext);
  if (!ctx) {
    throw new Error("useMotionPreference must be used within MotionProvider");
  }
  return ctx;
}
