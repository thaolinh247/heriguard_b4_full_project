import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number | null, duration = 600): number {
  const [value, setValue] = useState(0);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (target === null) {
      prevValueRef.current = 0;
      if (mountedRef.current) setValue(0);
      return;
    }

    const start = prevValueRef.current;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) {
      prevValueRef.current = target;
      if (mountedRef.current) setValue(target);
      return;
    }

    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;

      if (mountedRef.current) {
        setValue(current);
      }

      if (progress < 1) {
        animRef.current = setTimeout(tick, 16);
      } else {
        prevValueRef.current = target;
      }
    };

    if (animRef.current) clearTimeout(animRef.current);
    animRef.current = setTimeout(tick, 16);

    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, [target, duration]);

  return value;
}
