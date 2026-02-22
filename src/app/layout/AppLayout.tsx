import { NavLink, Outlet } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/form", label: "Form" },
  { to: "/components", label: "Componentes" },
  { to: "/settings", label: "Config" }
];

export function AppLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
      <a href="#main-content" className="focus-ring sr-only rounded-pill px-3 py-2 focus:not-sr-only">
        Pular para conteúdo
      </a>

      <header className="surface mb-6 rounded-lg p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-label text-[var(--color-muted)]">Proteja sua Casa</p>
            <h1 className="text-h1">Design System Web</h1>
            <p className="text-small text-[var(--color-muted)]">Minimalismo premium com foco em usabilidade.</p>
          </div>
          <Button
            variant="secondary"
            onClick={toggleTheme}
            className="self-start md:self-auto"
            aria-label="Alternar tema"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} className="h-4 w-4" />
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </Button>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "focus-ring rounded-pill px-3 py-2 text-small font-semibold transition-colors duration-[var(--motion-fast)] ease-premium",
                  isActive
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/5"
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
