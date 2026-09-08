import styles from "./MenuBar.module.css";
import { Clock } from "./Clock";

export function MenuBar() {
  return (
    <div className={styles.menuBar}>
      <Clock />
    </div>
  );
}
