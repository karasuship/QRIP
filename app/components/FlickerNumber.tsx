"use client";

import { useEffect, useState } from "react";

const CHARS = "0123456789.-+%";

function scramble(target: string, progress: number): string {
  return target
    .split("")
    .map((ch, i) => {
      const charP = Math.max(0, progress * 1.6 - (i / target.length) * 0.6);
      if (charP >= 1 || !CHARS.includes(ch)) return ch;
      return CHARS[Math.floor(Math.random() * CHARS.length)];
    })
    .join("");
}

interface Props {
  value: string;
  className?: string;
  duration?: number;
  delay?: number;
}

export function FlickerNumber({ value, className, duration = 650, delay = 80 }: Props) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        if (p < 1) {
          setDisplay(scramble(value, p));
          requestAnimationFrame(tick);
        } else {
          setDisplay(value);
        }
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [value, duration, delay]);

  return <span className={className}>{display}</span>;
}
