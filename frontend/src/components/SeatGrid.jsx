import { useMemo } from 'react';

// Groups a flat seat list into rows keyed by the leading letter (A, B, C…)
// and renders selectable, colour-coded seat buttons.
export default function SeatGrid({ seats, selected, onToggle, disabled }) {
  const rows = useMemo(() => {
    const grouped = new Map();
    for (const seat of seats) {
      const rowLabel = seat.seatNumber.match(/^[A-Za-z]+/)?.[0] || '?';
      if (!grouped.has(rowLabel)) grouped.set(rowLabel, []);
      grouped.get(rowLabel).push(seat);
    }
    const seatNum = (s) => Number(s.seatNumber.replace(/^[A-Za-z]+/, '')) || 0;
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, rowSeats]) => [label, rowSeats.sort((a, b) => seatNum(a) - seatNum(b))]);
  }, [seats]);

  return (
    <div className="seatmap">
      <div className="screen">SCREEN / STAGE</div>
      <div className="seat-scroll">
        <div className="seat-rows">
        {rows.map(([label, rowSeats]) => (
          <div key={label} className="seat-row">
            <span className="row-label">{label}</span>
            {rowSeats.map((seat) => {
              const isSelected = selected.has(seat.seatNumber);
              const isFree = seat.status === 'available';
              const className = isSelected
                ? 'seat-selected'
                : `seat-${seat.status}`;
              return (
                <button
                  type="button"
                  key={seat.seatNumber}
                  className={`seat ${className}`}
                  disabled={disabled || (!isFree && !isSelected)}
                  onClick={() => onToggle(seat.seatNumber)}
                  aria-pressed={isSelected}
                  title={`${seat.seatNumber} — ${isSelected ? 'selected' : seat.status}`}
                >
                  {seat.seatNumber.replace(/^[A-Za-z]+/, '')}
                </button>
              );
            })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
