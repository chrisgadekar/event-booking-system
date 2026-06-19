import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="brand">
          Sort<span>My</span>Scene
        </Link>

        {user && (
          <nav className="navbar-links">
            <NavLink to="/" end className="nav-link">
              Events
            </NavLink>
            <NavLink to="/bookings" className="nav-link">
              My Bookings
            </NavLink>
          </nav>
        )}

        <div className="navbar-user">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user && (
            <>
              <span className="navbar-greeting">Hi, {user.name}</span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
