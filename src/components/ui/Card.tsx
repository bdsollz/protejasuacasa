import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "elevated" | "outlined" | "filled";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  interactive?: boolean;
};

const styles: Record<CardVariant, string> = {
  elevated: "surface shadow-[var(--shadow-soft)]",
  outlined: "border border-[var(--color-border)] bg-transparent",
  filled: "bg-[var(--color-surface)]/80 border border-transparent"
};

export function Card({ className, variant = "elevated", interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-4",
        styles[variant],
        interactive &&
          "focus-ring transition-transform duration-150 ease-premium hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40",
        className
      )}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    />
  );
}
