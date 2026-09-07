import styles from "./Desktop.module.css";
import { MenuBar } from "./MenuBar";
import { Desktop } from "./Desktop";

/** The System 7.5 OS shell: menu bar over the desktop surface. */
export function Finder() {
  return (
    <div className={styles.finder}>
      <MenuBar />
      <Desktop />
    </div>
  );
}
