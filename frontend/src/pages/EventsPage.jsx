import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import Alert from '../components/Alert.jsx';
import { EventListSkeleton } from '../components/Skeleton.jsx';

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

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await api.get('/events');
        if (active) setEvents(data.events);
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Could not load events'));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <h1 className="page-title">Upcoming Events</h1>
      <Alert onClose={() => setError('')}>{error}</Alert>

      {loading ? (
        <EventListSkeleton />
      ) : events.length === 0 && !error ? (
        <p className="muted">No events available right now.</p>
      ) : (
        <div className="event-grid">
          {events.map((event) => {
            const soldOut = event.availableSeats === 0;
            return (
              <Link key={event._id} to={`/events/${event._id}`} className="event-card card">
                <div className="event-card-body">
                  <h2 className="event-name">{event.name}</h2>
                  <p className="event-meta">{formatDate(event.startsAt)}</p>
                  <p className="event-meta">📍 {event.venue}</p>
                  {event.description && <p className="event-desc">{event.description}</p>}
                </div>
                <div className="event-card-footer">
                  <span className={`badge ${soldOut ? 'badge-muted' : 'badge-success'}`}>
                    {soldOut ? 'Sold out' : `${event.availableSeats} seats left`}
                  </span>
                  <span className="link-cta">Select seats →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
