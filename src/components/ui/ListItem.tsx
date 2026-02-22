import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ListItemProps = {
  leading?: ReactNode;
  trailing?: ReactNode;
  title: string;
  description?: string;
  active?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function ListItem({
  leading,
  trailing,
  title,
  description,
  active = false,
  className,
  ...props
}: ListItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "focus-ring w-full rounded-md border border-[var(--color-border)] px-3 py-3 text-left",
        "transition-all duration-150 ease-premium hover:bg-white/5 active:scale-[0.995]",
        active && "border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {leading ? <div className="shrink-0 text-[var(--color-muted)]">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {description ? <p className="truncate text-sm text-[var(--color-muted)]">{description}</p> : null}
        </div>
        {trailing ? <div className="shrink-0 text-[var(--color-muted)]">{trailing}</div> : null}
      </div>
    </button>
  );
}
