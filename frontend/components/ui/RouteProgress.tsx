'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function RouteProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => timers.current.forEach(clearTimeout);

  useEffect(() => {
    clear();
    setVisible(true);
    setWidth(0);

    timers.current = [
      setTimeout(() => setWidth(30), 10),
      setTimeout(() => setWidth(70), 200),
      setTimeout(() => setWidth(90), 500),
      setTimeout(() => setWidth(100), 800),
      setTimeout(() => setVisible(false), 1050),
    ];

    return clear;
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none">
      <div
        className="h-full bg-linear-to-r from-blue-500 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
        style={{
          width: `${width}%`,
          transition: width === 0 ? 'none' : 'width 0.3s ease',
        }}
      />
    </div>
  );
}
