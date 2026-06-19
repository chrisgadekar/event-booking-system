import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import Alert from '../components/Alert.jsx';

export default function LoginPage() {
  const { login, register, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/';

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already authenticated → skip the form.
  if (token) {
    navigate(redirectTo, { replace: true });
    return null;
  }

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card card">
      <h1 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="auth-subtitle">
        {mode === 'login'
          ? 'Log in to reserve and book your seats.'
          : 'Sign up to start booking tickets.'}
      </p>

      <Alert onClose={() => setError('')}>{error}</Alert>

      <form onSubmit={handleSubmit} className="form">
        {mode === 'register' && (
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={update('name')}
              required
              autoComplete="name"
            />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>

      <p className="auth-switch">
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>

      {mode === 'login' && (
        <p className="auth-hint">
          Demo login: <code>demo@sortmyscene.test</code> / <code>password123</code>
        </p>
      )}
    </div>
  );
}
