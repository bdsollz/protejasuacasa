import { Link } from "react-router-dom";
import { Card, Button } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <Card>
      <h2 className="text-h2">Página não encontrada</h2>
      <p className="mt-2 text-body text-[var(--color-muted)]">A rota solicitada não existe neste demo.</p>
      <Link to="/" className="mt-4 inline-block">
        <Button>Voltar para dashboard</Button>
      </Link>
    </Card>
  );
}
