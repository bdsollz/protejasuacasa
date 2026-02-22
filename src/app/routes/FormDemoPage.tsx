import { useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Button, Card, TextField, useToast } from "@/components/ui";
import { useMotionPreference } from "@/lib/motion";

type FormState = {
  nome: string;
  email: string;
};

export default function FormDemoPage() {
  const { shouldReduceMotion } = useMotionPreference();
  const { pushToast } = useToast();
  const [form, setForm] = useState<FormState>({ nome: "", email: "" });
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    return {
      nome: submitted && form.nome.trim().length < 3 ? "Informe ao menos 3 caracteres." : "",
      email:
        submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
          ? "Digite um e-mail válido."
          : ""
    };
  }, [form, submitted]);

  const hasError = Boolean(errors.nome || errors.email);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (hasError) {
      pushToast("Corrija os campos obrigatórios.", "danger");
      return;
    }

    pushToast("Formulário validado com sucesso.", "success");
  }

  return (
    <motion.section
      className="space-y-5"
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.12 : 0.26 }}
    >
      <Card>
        <h2 className="text-h2">Formulário com validação</h2>
        <p className="mt-1 text-body text-[var(--color-muted)]">
          Exemplo de helper text, erros acessíveis e foco visível.
        </p>

        <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
          <TextField
            label="Nome"
            required
            value={form.nome}
            onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
            helperText="Use seu nome de exibição."
            errorText={errors.nome || undefined}
            placeholder="Ex: Robson"
          />

          <TextField
            label="E-mail"
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            helperText="Será usado para notificações."
            errorText={errors.email || undefined}
            placeholder="nome@email.com"
          />

          <div className="flex gap-2">
            <Button type="submit">Salvar</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setForm({ nome: "", email: "" });
                setSubmitted(false);
              }}
            >
              Limpar
            </Button>
          </div>
        </form>
      </Card>
    </motion.section>
  );
}
