const HOME_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5"/><path d="M4 6.5V13h8V6.5"/><path d="M6.5 13v-3h3v3"/></svg>';

// Holds the go-home button while the robot is out; positioned by CSS within `parent`.
export class Toolbar {
  readonly element = document.createElement("div");
  private readonly button = document.createElement("button");

  constructor(parent: Element, onHome: () => void) {
    this.element.className = "robot-toolbar";
    const { button } = this;
    button.type = "button";
    button.title = "Go home";
    button.setAttribute("aria-label", "Go home");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = HOME_ICON;
    button.addEventListener("click", () => {
      button.setAttribute("aria-pressed", "true");
      onHome();
    });
    this.element.append(button);
    parent.append(this.element);
  }

  show(): void {
    this.button.setAttribute("aria-pressed", "false");
    this.element.classList.add("visible");
  }

  hide(): void {
    this.element.classList.remove("visible");
  }
}
