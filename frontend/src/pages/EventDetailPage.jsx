import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import SeatGrid from '../components/SeatGrid.jsx';
import SeatLegend from '../components/SeatLegend.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import { SeatMapSkeleton } from '../components/Skeleton.jsx';
import Alert from '../components/Alert.jsx';
import { useToast } from '../context/ToastContext.jsx';

const POLL_INTERVAL_MS = 7000;

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EventDetailPage() {
  const { id } = useParams();
  const toast = useToast();

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // phase: 'selecting' | 'reserved' | 'booked'
  const [phase, setPhase] = useState('selecting');
  const [reservation, setReservation] = useState(null);
  const [booking, setBooking] = useState(null);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Keep the latest phase available to the polling closure.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const loadEvent = useCallback(async () => {
    const { data } = await api.get(`/events/${id}`);
    setEvent(data.event);
    setSeats(data.seats);
    return data.seats;
  }, [id]);

  // Initial load: fetch the event, then rehydrate any in-progress hold so a
  // page refresh doesn't lose the reservation.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadEvent();
        const { data } = await api.get('/reserve/active', { params: { eventId: id } });
        if (active && data.reservation) {
          setReservation(data.reservation);
          setSelected(new Set(data.reservation.seatNumbers));
          setPhase('reserved');
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Could not load this event'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadEvent, id]);

  // Live seat map: poll while the user is choosing or holding seats so they see
  // availability change in near real time. Drops any selected seat that gets
  // taken by someone else before reservation.
  useEffect(() => {
    if (phase === 'booked') return undefined;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/events/${id}`);
        setSeats(data.seats);
        if (phaseRef.current === 'selecting') {
          const available = new Set(
            data.seats.filter((s) => s.status === 'available').map((s) => s.seatNumber)
          );
          setSelected((prev) => {
            const lost = [...prev].filter((s) => !available.has(s));
            if (lost.length === 0) return prev;
            toast.info(`Seat ${lost.join(', ')} was just taken by someone else`);
            return new Set([...prev].filter((s) => available.has(s)));
          });
        }
      } catch {
        /* transient poll failure — ignore and retry next tick */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, id, toast]);

  function toggleSeat(seatNumber) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seatNumber)) next.delete(seatNumber);
      else next.add(seatNumber);
      return next;
    });
  }

  async function handleReserve() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const seatNumbers = [...selected];
      const { data } = await api.post('/reserve', { eventId: id, seatNumbers });
      setReservation(data.reservation);
      setSelected(new Set(data.reservation.seatNumbers));
      setPhase('reserved');
      await loadEvent().catch(() => {});
      toast.success('Seats held — confirm before the timer runs out.');
    } catch (err) {
      // A seat was taken between selection and reserve — refresh and re-pick.
      toast.error(getErrorMessage(err, 'Could not reserve those seats'));
      setSelected(new Set());
      await loadEvent().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!reservation) return;
    setBusy(true);
    try {
      const { data } = await api.post('/bookings', { reservationId: reservation._id });
      setBooking(data.booking);
      setPhase('booked');
      await loadEvent().catch(() => {});
      toast.success('Booking confirmed!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Booking could not be completed'));
      if ([410, 409].includes(err?.response?.status)) {
        resetToSelection();
        await loadEvent().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!reservation) return;
    setBusy(true);
    try {
      await api.delete(`/reserve/${reservation._id}`);
      toast.info('Reservation released.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not release the reservation'));
    } finally {
      resetToSelection();
      await loadEvent().catch(() => {});
      setBusy(false);
    }
  }

  const handleExpire = useCallback(() => {
    setPhase('selecting');
    setReservation(null);
    setSelected(new Set());
    toast.info('Your reservation timed out and the seats were released.');
    loadEvent().catch(() => {});
  }, [loadEvent, toast]);

  function resetToSelection() {
    setPhase('selecting');
    setReservation(null);
    setSelected(new Set());
  }

  function bookAnother() {
    setBooking(null);
    resetToSelection();
    setError('');
  }

  if (loading) {
    return (
      <section>
        <div className="skeleton skeleton-line w-40" style={{ height: 28, marginBottom: 20 }} />
        <SeatMapSkeleton />
      </section>
    );
  }

  if (!event) {
    return (
      <div>
        <Alert>{error || 'Event not found'}</Alert>
        <Link to="/" className="btn btn-ghost">
          ← Back to events
        </Link>
      </div>
    );
  }

  return (
    <section>
      <Link to="/" className="back-link">
        ← All events
      </Link>

      <header className="event-header">
        <h1 className="page-title">{event.name}</h1>
        <p className="event-meta">{formatDate(event.startsAt)}</p>
        <p className="event-meta">📍 {event.venue}</p>
      </header>

      {phase === 'booked' ? (
        <div className="card booking-success">
          <div className="success-check">✓</div>
          <h2>Booking confirmed!</h2>
          <p>
            You&apos;ve booked <strong>{booking.seatNumbers.join(', ')}</strong> for{' '}
            <strong>{event.name}</strong>.
          </p>
          <div className="success-actions">
            <button type="button" className="btn btn-primary" onClick={bookAnother}>
              Book more seats
            </button>
            <Link to="/bookings" className="btn btn-ghost">
              View my bookings
            </Link>
          </div>
        </div>
      ) : (
        <div className="booking-layout">
          <div className="card seatmap-card">
            <SeatLegend />
            <SeatGrid
              seats={seats}
              selected={selected}
              onToggle={toggleSeat}
              disabled={phase === 'reserved' || busy}
            />
          </div>

          <aside className="card summary-card">
            <h2 className="summary-title">Your selection</h2>

            {phase === 'reserved' && reservation ? (
              <>
                <div className="timer-box">
                  <span>Seats held for</span>
                  <CountdownTimer expiresAt={reservation.expiresAt} onExpire={handleExpire} />
                </div>
                <ul className="seat-summary-list">
                  {reservation.seatNumbers.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={handleConfirm}
                  disabled={busy}
                >
                  {busy ? 'Confirming…' : 'Confirm booking'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={handleCancel}
                  disabled={busy}
                >
                  Cancel & re-select
                </button>
              </>
            ) : (
              <>
                {selected.size === 0 ? (
                  <p className="muted">Pick one or more available seats from the map.</p>
                ) : (
                  <ul className="seat-summary-list">
                    {[...selected].sort().map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                <div className="summary-count">
                  {selected.size} seat{selected.size === 1 ? '' : 's'} selected
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={handleReserve}
                  disabled={busy || selected.size === 0}
                >
                  {busy ? 'Reserving…' : 'Reserve seats'}
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
