import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/app/layout/AppLayout";
import { useMotionPreference } from "@/lib/motion";

const DashboardPage = lazy(() => import("@/app/routes/DashboardPage"));
const FormDemoPage = lazy(() => import("@/app/routes/FormDemoPage"));
const ComponentsPage = lazy(() => import("@/app/routes/ComponentsPage"));
const SettingsPage = lazy(() => import("@/app/routes/SettingsPage"));
const NotFoundPage = lazy(() => import("@/app/routes/NotFoundPage"));

function AnimatedRoutes() {
  const location = useLocation();
  const { shouldReduceMotion } = useMotionPreference();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -6 }}
        transition={{ duration: shouldReduceMotion ? 0.1 : 0.28, ease: [0.4, 0, 0.2, 1] }}
      >
        <Routes location={location}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/form" element={<FormDemoPage />} />
            <Route path="/components" element={<ComponentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="surface animate-pulse rounded-lg p-6 text-small text-[var(--color-muted)]">
              Carregando interface...
            </div>
          </div>
        }
      >
        <AnimatedRoutes />
      </Suspense>
    </BrowserRouter>
  );
}
