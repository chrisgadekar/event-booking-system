import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="centered-screen not-found">
      <h1>404</h1>
      <p className="muted">We couldn&apos;t find that page.</p>
      <Link to="/" className="btn btn-primary">
        Back to events
      </Link>
    </div>
  );
}
