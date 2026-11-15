import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { MailCheck, UserPlus } from 'lucide-react';
import type { FirebaseServices } from './firebase';
import { acceptInvitation } from './management/tenantSaas';
import { Banner, friendly } from './ui/kit';

/**
 * Accepting an invitation (Phase 8). The person signs in — or creates an
 * account — with the invited email, verifies it, then accepts. The security
 * rules only create the membership when the invitation's email equals the
 * verified sign-in email, so a forwarded link is useless to anyone else.
 */
export function Join({ services }: { services: FirebaseServices }) {
  const [params] = useSearchParams();
  const c = params.get('c') || '',
    t = params.get('t') || '';
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [done, setDone] = useState('');
  useEffect(() => onAuthStateChanged(services.auth, setUser), [services]);
  const base = import.meta.env.BASE_URL;
  const target = (role: string) =>
    role === 'customer'
      ? `${base}customer/`
      : ['owner', 'admin'].includes(role)
        ? base
        : `${base}staff/`;
  async function auth(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'create') {
        if (password.length < 8)
          throw Object.assign(
            new Error('Use at least 8 characters for the password.'),
            { user: true },
          );
        const r = await createUserWithEmailAndPassword(
          services.auth,
          email.trim(),
          password,
        );
        await sendEmailVerification(r.user).catch(() => undefined);
        setNotice(
          'Account created. We sent a verification email — open it, then come back and press “I have verified”.',
        );
      } else
        await signInWithEmailAndPassword(services.auth, email.trim(), password);
    } catch (x) {
      const code = (x as { code?: string }).code || '';
      setError(
        (x as { user?: boolean }).user
          ? (x as Error).message
          : code === 'auth/email-already-in-use'
            ? 'An account with this email exists. Sign in instead.'
            : friendly(x),
      );
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await user.reload();
      // The security rules read email_verified from the ID token, so refresh it after verifying.
      await (services.auth.currentUser || user).getIdToken(true);
      const role = await acceptInvitation(
        services.db,
        c,
        t,
        services.auth.currentUser || user,
      );
      setDone(role);
    } catch (x) {
      setError(
        x instanceof Error && !(x as { code?: string }).code
          ? x.message
          : friendly(x),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="center-state">
      <section
        className="card card-pad join-card"
        style={{ maxWidth: 460, width: '100%' }}
      >
        <h1>Join a company on FacilityOS</h1>
        {!c || !t ? (
          <Banner tone="red">
            This invitation link is incomplete. Ask for a new link.
          </Banner>
        ) : done ? (
          <>
            <Banner tone="green" title="You have joined">
              Your access is ready
              {done !== 'owner' && done !== 'admin'
                ? '. An administrator may still need to link you to your employee or client record.'
                : '.'}
            </Banner>
            <a className="btn btn-primary" href={target(done)}>
              Continue
            </a>
          </>
        ) : user === undefined ? (
          <p className="muted">Checking your session…</p>
        ) : !user ? (
          <form onSubmit={auth} noValidate className="auth-form">
            <p className="muted">
              Sign in, or create an account, with the email address the
              invitation was sent to.
            </p>
            <div className="field">
              <label htmlFor="join-email">Email</label>
              <input
                id="join-email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="join-password">Password</label>
              <input
                id="join-password"
                className="input"
                type="password"
                autoComplete={
                  mode === 'create' ? 'new-password' : 'current-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <Banner tone="red" role="alert">
                {error}
              </Banner>
            )}
            {notice && <Banner tone="green">{notice}</Banner>}
            <button
              className="btn btn-primary btn-block"
              disabled={busy || !email || !password}
            >
              {mode === 'create' ? <UserPlus /> : null}{' '}
              {mode === 'create' ? 'Create account' : 'Sign in'}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => setMode(mode === 'create' ? 'signin' : 'create')}
            >
              {mode === 'create'
                ? 'I already have an account'
                : 'I need to create an account'}
            </button>
          </form>
        ) : (
          <>
            <p>
              Signed in as <strong>{user.email}</strong>
              {user.emailVerified ? '' : ' (email not verified yet)'}.
            </p>
            {notice && <Banner tone="green">{notice}</Banner>}
            {error && (
              <Banner tone="red" role="alert">
                {error}
              </Banner>
            )}
            {!user.emailVerified && (
              <Banner tone="amber" title="Verify your email first">
                Open the verification email and click the link. Didn’t get it?{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() =>
                    sendEmailVerification(user)
                      .then(() => setNotice('Verification email sent again.'))
                      .catch((x) => setError(friendly(x)))
                  }
                >
                  Send again
                </button>
              </Banner>
            )}
            <div className="toolbar">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void accept()}
              >
                <MailCheck />{' '}
                {user.emailVerified
                  ? 'Accept invitation'
                  : 'I have verified — accept'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void signOut(services.auth)}
              >
                Use another account
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
