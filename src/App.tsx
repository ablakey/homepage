import { useState } from "react";
import styles from "./App.module.css";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className={styles.app}>
      <h1>Homepage</h1>
      <button className={styles.button} onClick={() => setCount((c) => c + 1)}>
        count is {count}
      </button>
    </main>
  );
}
