import styles from "./Finder.module.css";
import { MenuBar } from "./menubar/MenuBar";
import { Desktop } from "./desktop/Desktop";

/** The System 7.5 OS shell: menu bar over the desktop surface. */
export function Finder() {
  return (
    <div className={styles.finder}>
      <MenuBar />
      <Desktop />
    </div>
  );
}
