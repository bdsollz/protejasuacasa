import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/lib/theme";
import { MotionProvider } from "@/lib/motion";
import { ToastProvider } from "@/components/ui/Toast";
import { App } from "@/app/App";
import "@/styles/tokens.css";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <MotionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MotionProvider>
    </ThemeProvider>
  </React.StrictMode>
);
