import { useEffect, useState } from "react";
import styles from "./MenuBar.module.css";

function formatTime(date: Date): string {
  const hours = ((date.getHours() + 11) % 12) + 1;
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function Clock() {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return <div className={styles.clock}>{time}</div>;
}
