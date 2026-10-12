export type Mode = "automap" | "click" | "home";

const svg = (body: string) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const BUTTONS: readonly { mode: Mode; label: string; icon: string }[] = [
  {
    mode: "automap",
    label: "Automap",
    icon: svg(
      '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><path d="M8 8l4.2-4.2"/>',
    ),
  },
  {
    mode: "click",
    label: "Click to set goal",
    icon: svg('<path d="M4 2.5v10l2.8-2.6 1.9 4 1.7-.8-1.9-3.9H12z"/>'),
  },
  {
    mode: "home",
    label: "Go home",
    icon: svg(
      '<path d="M2.5 7.5 8 3l5.5 4.5"/><path d="M4 6.5V13h8V6.5"/><path d="M6.5 13v-3h3v3"/>',
    ),
  },
];

// Icon-only mode picker; positioned by CSS within `parent`.
export class Toolbar {
  readonly element = document.createElement("div");
  private readonly buttons = new Map<Mode, HTMLButtonElement>();

  constructor(parent: Element, onSelect: (mode: Mode) => void) {
    this.element.className = "robot-toolbar";
    this.element.setAttribute("role", "toolbar");
    for (const { mode, label, icon } of BUTTONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.title = label;
      button.setAttribute("aria-label", label);
      button.innerHTML = icon;
      button.addEventListener("click", () => {
        this.select(mode);
        onSelect(mode);
      });
      this.buttons.set(mode, button);
      this.element.append(button);
    }
    parent.append(this.element);
  }

  show(): void {
    this.element.classList.add("visible");
  }

  hide(): void {
    this.element.classList.remove("visible");
  }

  select(mode: Mode): void {
    for (const [m, button] of this.buttons) {
      button.setAttribute("aria-pressed", String(m === mode));
    }
  }
}
