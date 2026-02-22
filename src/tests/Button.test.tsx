import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui";

describe("Button", () => {
  it("renderiza estado loading como desabilitado", () => {
    render(<Button loading>Salvar</Button>);

    const button = screen.getByRole("button", { name: /salvar/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
