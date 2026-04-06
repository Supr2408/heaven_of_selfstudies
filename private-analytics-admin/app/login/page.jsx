'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getStoredToken, loginAdmin } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getStoredToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await loginAdmin({ username, password });
      router.replace('/dashboard');
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="hero-badge">Private Analytics Control</div>
        <h1>Monitor study activity, live engagement, and daily exports.</h1>
        <p>
          This dashboard is separate from the public learner app and is designed
          only for private administrative reporting.
        </p>

        <div className="hero-grid">
          <div className="hero-card">
            <ShieldCheck size={20} />
            <div>
              <h2>Admin-only access</h2>
              <p>Protected with a private login and detached from the public UI.</p>
            </div>
          </div>

          <div className="hero-card">
            <LockKeyhole size={20} />
            <div>
              <h2>Private data flow</h2>
              <p>The public backend can forward tracked study events here securely.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="panel-badge">Admin Sign-In</div>
        <h2>Open the analytics workspace</h2>
        <p>Use the private admin credentials configured in the analytics service env.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="admin"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Enter dashboard'}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
