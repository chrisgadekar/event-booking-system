// Lightweight shimmer placeholders shown while data loads.

export function EventListSkeleton() {
  return (
    <div className="event-grid">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton skeleton-line w-70" />
          <div className="skeleton skeleton-line w-50" />
          <div className="skeleton skeleton-line w-90" />
          <div className="skeleton skeleton-pill" />
        </div>
      ))}
    </div>
  );
}

export function SeatMapSkeleton() {
  return (
    <div className="card">
      <div className="skeleton skeleton-line w-40" style={{ margin: '0 auto 24px' }} />
      <div className="seat-rows">
        {Array.from({ length: 5 }).map((_, r) => (
          <div key={r} className="seat-row">
            {Array.from({ length: 8 }).map((__, c) => (
              <div key={c} className="skeleton skeleton-seat" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
