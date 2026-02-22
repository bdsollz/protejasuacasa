import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "@/components/ui";

describe("TextField", () => {
  it("marca aria-invalid quando há erro", () => {
    render(<TextField label="Email" errorText="E-mail inválido" value="x" onChange={() => undefined} />);

    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/e-mail inválido/i)).toBeInTheDocument();
  });
});
