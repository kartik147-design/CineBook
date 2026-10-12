import { useState } from 'react';

function AuthModal({ mode, busy, onClose, onSubmit, onModeChange }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const isSignup = mode === 'signup';
  const isAdmin = mode === 'admin';

  const submit = (event) => {
    event.preventDefault();
    onSubmit(mode, form);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="auth-brand">C</div>
        <p className="section-kicker">{isAdmin ? 'Staff access' : 'Your next movie night'}</p>
        <h2 id="auth-title">
          {isSignup ? 'Create your account' : isAdmin ? 'Admin sign in' : 'Welcome back'}
        </h2>
        <p className="auth-subtitle">
          {isAdmin
            ? 'Use the admin credentials configured by the site operator.'
            : 'Sign in to save your plans and keep your bookings together.'}
        </p>
        <form className="auth-form" onSubmit={submit}>
          {isSignup && (
            <label>
              Full name
              <input
                autoComplete="name"
                minLength="2"
                required
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Your name"
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={isSignup ? 8 : undefined}
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
            />
          </label>
          <button className="button button-primary button-wide" disabled={busy} type="submit">
            {busy ? 'Please wait…' : isSignup ? 'Create account' : isAdmin ? 'Sign in as admin' : 'Sign in'}
          </button>
        </form>
        {!isAdmin && (
          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New to CineBook?'}
            <button
              type="button"
              onClick={() => onModeChange(isSignup ? 'login' : 'signup')}
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        )}
        {isAdmin && <p className="demo-note">Admin credentials are read from backend environment variables.</p>}
      </section>
    </div>
  );
}

export default AuthModal;
