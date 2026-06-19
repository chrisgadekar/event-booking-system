const ITEMS = [
  { label: 'Available', className: 'seat-available' },
  { label: 'Selected', className: 'seat-selected' },
  { label: 'Reserved', className: 'seat-reserved' },
  { label: 'Booked', className: 'seat-booked' },
];

export default function SeatLegend() {
  return (
    <div className="legend">
      {ITEMS.map((item) => (
        <div key={item.label} className="legend-item">
          <span className={`seat seat-sample ${item.className}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
