import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button, Card, ListItem, Modal, TextField } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useMotionPreference } from "@/lib/motion";

export default function ComponentsPage() {
  const { shouldReduceMotion } = useMotionPreference();
  const [openModal, setOpenModal] = useState(false);
  const [fieldValue, setFieldValue] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <motion.section
      className="space-y-5"
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.12 : 0.26 }}
    >
      <Card>
        <h2 className="text-h2">Botões</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-h2">Cards</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Card variant="elevated">Elevated</Card>
          <Card variant="outlined" interactive>
            Outlined interactive
          </Card>
          <Card variant="filled">Filled</Card>
        </div>
      </Card>

      <Card>
        <h2 className="text-h2">List items</h2>
        <div className="mt-4 space-y-2">
          <ListItem
            title="Atualização de sessão"
            description="12 jogadores ativos"
            leading={<Icon name="check" className="h-4 w-4" />}
            trailing={<Icon name="arrow-right" className="h-4 w-4" />}
          />
          <ListItem
            active
            title="Alerta de latência"
            description="Pico detectado no cluster 2"
            leading={<Icon name="alert" className="h-4 w-4" />}
            trailing={<Icon name="arrow-right" className="h-4 w-4" />}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-h2">TextField + Modal</h2>
        <div className="mt-4 space-y-4">
          <TextField
            label="Campo de demonstração"
            value={fieldValue}
            onChange={(event) => setFieldValue(event.target.value)}
            helperText="Helper text padrão"
          />
          <TextField
            label="Campo com erro"
            value=""
            onChange={() => undefined}
            errorText="Mensagem de erro visível"
            aria-invalid
          />
          <Button onClick={() => setOpenModal(true)}>Abrir modal</Button>
        </div>
      </Card>

      <Modal
        open={openModal}
        title="Confirmação"
        description="Exemplo de diálogo com foco preso e fechamento por ESC."
        onClose={() => setOpenModal(false)}
        initialFocusRef={closeRef}
      >
        <div className="flex justify-end gap-2">
          <Button ref={closeRef} variant="ghost" onClick={() => setOpenModal(false)}>
            Fechar
          </Button>
          <Button onClick={() => setOpenModal(false)}>Confirmar</Button>
        </div>
      </Modal>
    </motion.section>
  );
}
