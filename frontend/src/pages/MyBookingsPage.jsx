import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import Alert from '../components/Alert.jsx';

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get('/bookings');
        if (active) setBookings(data.bookings);
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Could not load your bookings'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="centered-screen">Loading your bookings…</div>;

  return (
    <section>
      <h1 className="page-title">My Bookings</h1>
      <Alert onClose={() => setError('')}>{error}</Alert>

      {bookings.length === 0 && !error ? (
        <div className="empty-state card">
          <p className="muted">You haven&apos;t booked any seats yet.</p>
          <Link to="/" className="btn btn-primary">
            Browse events
          </Link>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((b) => (
            <div key={b.id} className="card booking-row">
              <div>
                <h2 className="booking-event">{b.event?.name || 'Event'}</h2>
                <p className="event-meta">{b.event && formatDate(b.event.startsAt)}</p>
                {b.event?.venue && <p className="event-meta">📍 {b.event.venue}</p>}
                <p className="booking-stamp muted">Booked {formatDate(b.bookedAt)}</p>
              </div>
              <div className="booking-seats">
                <span className="muted">Seats</span>
                <div className="seat-summary-list">
                  {b.seatNumbers.map((s) => (
                    <span key={s} className="seat-chip">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
