import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/ui";

describe("Modal", () => {
  it("fecha ao pressionar Escape", () => {
    const onClose = vi.fn();

    render(
      <Modal open title="Teste" onClose={onClose}>
        <button type="button">Ação</button>
      </Modal>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
