import { motion } from "framer-motion";
import { Button, Card } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useMotionPreference, type MotionPreference } from "@/lib/motion";
import { useToast } from "@/components/ui";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { preference, setPreference, shouldReduceMotion } = useMotionPreference();
  const { pushToast } = useToast();

  const options: Array<{ value: MotionPreference; label: string }> = [
    { value: "system", label: "Sistema" },
    { value: "no-preference", label: "Completa" },
    { value: "reduce", label: "Reduzida" }
  ];

  return (
    <motion.section
      className="space-y-5"
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.12 : 0.26 }}
    >
      <Card>
        <h2 className="text-h2">Tema</h2>
        <p className="mt-2 text-small text-[var(--color-muted)]">Escolha entre escuro e claro.</p>
        <div className="mt-4 flex gap-2">
          <Button
            variant={theme === "dark" ? "primary" : "secondary"}
            onClick={() => {
              setTheme("dark");
              pushToast("Tema escuro aplicado.");
            }}
          >
            Escuro
          </Button>
          <Button
            variant={theme === "light" ? "primary" : "secondary"}
            onClick={() => {
              setTheme("light");
              pushToast("Tema claro aplicado.");
            }}
          >
            Claro
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-h2">Reduzir movimento</h2>
        <p className="mt-2 text-small text-[var(--color-muted)]">
          Override manual além de <code>prefers-reduced-motion</code>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={preference === option.value ? "primary" : "secondary"}
              onClick={() => setPreference(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Card>
    </motion.section>
  );
}
