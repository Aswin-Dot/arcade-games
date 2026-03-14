import { useEffect, useRef, useState } from 'react';

export const useGameLoop = (
  update: (deltaTime: number) => void,
  isRunning: boolean,
) => {
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
      return;
    }

    const loop = (timestamp: number) => {
      // First frame: lastTimeRef is 0, so delta = 0 (avoids massive first-frame jump)
      const delta = lastTimeRef.current ? Math.max(0, Math.min(timestamp - lastTimeRef.current, 100)) : 0;
      lastTimeRef.current = timestamp;
      if (delta > 0) {
        setFps(Math.round(1000 / delta));
      }
      update(delta);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, update]);

  return { fps };
};
