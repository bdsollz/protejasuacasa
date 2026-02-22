import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import loaderData from "@/assets/lottie/loader.json";

export function LottieBadge() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: loaderData
    });

    return () => anim.destroy();
  }, []);

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-2">
      <div
        ref={containerRef}
        aria-label="Animação de carregamento"
        role="img"
        className="h-14 w-14"
      />
    </div>
  );
}
