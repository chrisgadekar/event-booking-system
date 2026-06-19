import { useEffect, useRef, useState } from 'react';

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Counts down to `expiresAt` and fires `onExpire` once when it lapses.
// Remaining time is derived from a ticking `now` so we never call setState
// synchronously inside an effect.
export default function CountdownTimer({ expiresAt, onExpire }) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  const remaining = new Date(expiresAt).getTime() - now;

  useEffect(() => {
    firedRef.current = false;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [remaining, onExpire]);

  const expired = remaining <= 0;
  const urgent = !expired && remaining < 60 * 1000;

  return (
    <span className={`countdown ${urgent ? 'countdown-urgent' : ''}`}>
      {expired ? '00:00' : formatRemaining(remaining)}
    </span>
  );
}
