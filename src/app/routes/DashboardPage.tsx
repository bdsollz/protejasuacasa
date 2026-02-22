import { motion } from "framer-motion";
import { Card, Button, ListItem } from "@/components/ui";
import { Icon } from "@/components/Icon";
import emptyState from "@/assets/illustrations/empty-state.svg";
import { LottieBadge } from "@/components/LottieBadge";
import { useMotionPreference } from "@/lib/motion";
import { useToast } from "@/components/ui";

const updates = [
  "Sala A7D5 iniciada com 4 jogadores",
  "Novo conjunto de desafios carregado",
  "Modo Palavras e Contas com maior retenção",
  "Latência média na última sessão: 74ms",
  "Checklist de acessibilidade validado"
];

export default function DashboardPage() {
  const { shouldReduceMotion } = useMotionPreference();
  const { pushToast } = useToast();

  return (
    <motion.section
      className="space-y-5"
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.12 : 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="overflow-hidden">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5 md:p-7">
          <p className="text-label text-[var(--color-muted)]">Painel principal</p>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-display">Experiência clara e responsiva</h2>
              <p className="mt-2 max-w-2xl text-body text-[var(--color-muted)]">
                Interface otimizada para ações rápidas, leitura limpa e feedback imediato em cada etapa.
              </p>
            </div>
            <Button onClick={() => pushToast("Fluxo principal iniciado", "success")}>Iniciar fluxo</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="outlined">
          <p className="text-label text-[var(--color-muted)]">Sessões ativas</p>
          <p className="mt-2 text-h2">12</p>
        </Card>
        <Card variant="outlined">
          <p className="text-label text-[var(--color-muted)]">Engajamento</p>
          <p className="mt-2 text-h2">87%</p>
        </Card>
        <Card variant="outlined" className="flex items-center justify-between">
          <div>
            <p className="text-label text-[var(--color-muted)]">Sincronização</p>
            <p className="mt-2 text-h2">Tempo real</p>
          </div>
          <LottieBadge />
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-h2">Atualizações</h3>
          <Icon name="search" className="h-5 w-5 text-[var(--color-muted)]" />
        </div>
        <div className="cv-auto mt-3 space-y-2">
          {updates.map((item, index) => (
            <ListItem
              key={item}
              title={item}
              description={`Registro #${index + 1}`}
              leading={<Icon name="check" className="h-4 w-4" />}
              trailing={<Icon name="arrow-right" className="h-4 w-4" />}
            />
          ))}
        </div>
      </Card>

      <Card className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h3 className="text-h2">Estado vazio elegante</h3>
          <p className="mt-2 text-body text-[var(--color-muted)]">
            Utilize ilustrações leves para comunicar contexto sem distrair o usuário.
          </p>
        </div>
        <img src={emptyState} alt="Ilustração minimalista de estado vazio" className="h-auto w-full max-w-sm" loading="lazy" />
      </Card>
    </motion.section>
  );
}
