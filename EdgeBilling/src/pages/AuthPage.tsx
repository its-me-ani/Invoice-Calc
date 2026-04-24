/**
 * AuthPage — Email / Password Sign In & Sign Up
 * Shows before onboarding for cloud-synced accounts.
 * "Continue Offline" button skips auth entirely.
 */

import React, { useState } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
    mailOutline,
    lockClosedOutline,
    cloudOfflineOutline,
    alertCircleOutline,
    cloudDoneOutline,
} from 'ionicons/icons';
import { useAuth, friendlyError } from '../hooks/useAuth';
import { isAwsConfigured } from '../aws/aws-config';
import './AuthPage.css';

type Screen = 'signin' | 'signup' | 'confirm';

const AuthPage: React.FC = () => {
    const history = useHistory();
    const { signIn, signUp, confirmSignUp, resendCode, continueOffline } = useAuth();
    const awsEnabled = isAwsConfigured();

    const [screen, setScreen] = useState<Screen>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmCode, setConfirmCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendMsg, setResendMsg] = useState('');

    const clearError = () => { setError(''); setResendMsg(''); };

    // ── Navigate to next screen after auth ──────────────────────────────────
    const afterAuth = () => {
        const onboarded = localStorage.getItem('app_onboarding_complete');
        history.replace(onboarded ? '/app/dashboard' : '/onboarding');
    };

    // ── Sign In ──────────────────────────────────────────────────────────────
    const handleSignIn = async () => {
        clearError();
        if (!email || !password) { setError('Please enter your email and password.'); return; }
        setLoading(true);
        try {
            await signIn(email, password);
            afterAuth();
        } catch (e: any) {
            setError(friendlyError(e));
        } finally {
            setLoading(false);
        }
    };

    // ── Sign Up ──────────────────────────────────────────────────────────────
    const handleSignUp = async () => {
        clearError();
        if (!email || !password) { setError('Please enter your email and password.'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        setLoading(true);
        try {
            const result = await signUp(email, password);
            if (result.needsConfirmation) {
                setScreen('confirm');
            } else {
                await signIn(email, password);
                afterAuth();
            }
        } catch (e: any) {
            setError(friendlyError(e));
        } finally {
            setLoading(false);
        }
    };

    // ── Confirm OTP ───────────────────────────────────────────────────────────
    const handleConfirm = async () => {
        clearError();
        if (!confirmCode) { setError('Enter the verification code from your email.'); return; }
        setLoading(true);
        try {
            await confirmSignUp(email, confirmCode);
            await signIn(email, password);
            afterAuth();
        } catch (e: any) {
            setError(friendlyError(e));
        } finally {
            setLoading(false);
        }
    };

    // ── Resend Code ───────────────────────────────────────────────────────────
    const handleResend = async () => {
        clearError();
        try {
            await resendCode(email);
            setResendMsg('Code resent! Check your email.');
        } catch (e: any) {
            setError(friendlyError(e));
        }
    };

    // ── Offline ───────────────────────────────────────────────────────────────
    const handleOffline = () => {
        continueOffline();
        afterAuth();
    };

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <IonPage className="auth-page">
            <IonContent scrollY={false}>
                <div className="auth-content">

                    {/* Brand */}
                    <div className="auth-logo">
                        <div className="auth-logo-icon">🧾</div>
                        <h1>InvoiceCalc</h1>
                        <p>Professional Invoice Management</p>
                    </div>

                    {/* Tab switcher (only on signin/signup screens) */}
                    {screen !== 'confirm' && awsEnabled && (
                        <div className="auth-tabs">
                            <button
                                className={`auth-tab ${screen === 'signin' ? 'active' : ''}`}
                                onClick={() => { setScreen('signin'); clearError(); }}
                            >Sign In</button>
                            <button
                                className={`auth-tab ${screen === 'signup' ? 'active' : ''}`}
                                onClick={() => { setScreen('signup'); clearError(); }}
                            >Sign Up</button>
                        </div>
                    )}

                    {/* Card */}
                    <div className="auth-card">

                        {/* ── SIGN IN ── */}
                        {screen === 'signin' && (
                            <>
                                <h2>Welcome back</h2>
                                <p className="auth-subtitle">Sign in to sync your invoices across devices</p>

                                {error && (
                                    <div className="auth-error">
                                        <IonIcon icon={alertCircleOutline} />
                                        {error}
                                    </div>
                                )}

                                <div className="auth-field">
                                    <label>Email</label>
                                    <div className="auth-input-wrapper">
                                        <IonIcon icon={mailOutline} />
                                        <input
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>

                                <div className="auth-field">
                                    <label>Password</label>
                                    <div className="auth-input-wrapper">
                                        <IonIcon icon={lockClosedOutline} />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                                            autoComplete="current-password"
                                        />
                                    </div>
                                </div>

                                <button className="auth-btn-primary" onClick={handleSignIn} disabled={loading}>
                                    {loading ? <div className="auth-spinner" /> : <IonIcon icon={cloudDoneOutline} />}
                                    {loading ? 'Signing in…' : 'Sign In'}
                                </button>

                                <div className="auth-divider">or</div>

                                <button className="auth-btn-offline" onClick={handleOffline}>
                                    <IonIcon icon={cloudOfflineOutline} />
                                    Continue Offline
                                </button>
                            </>
                        )}

                        {/* ── SIGN UP ── */}
                        {screen === 'signup' && awsEnabled && (
                            <>
                                <h2>Create account</h2>
                                <p className="auth-subtitle">Start syncing your invoices to the cloud</p>

                                {error && (
                                    <div className="auth-error">
                                        <IonIcon icon={alertCircleOutline} />
                                        {error}
                                    </div>
                                )}

                                <div className="auth-field">
                                    <label>Email</label>
                                    <div className="auth-input-wrapper">
                                        <IonIcon icon={mailOutline} />
                                        <input
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>

                                <div className="auth-field">
                                    <label>Password <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>(min 8 chars)</span></label>
                                    <div className="auth-input-wrapper">
                                        <IonIcon icon={lockClosedOutline} />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </div>

                                <button className="auth-btn-primary" onClick={handleSignUp} disabled={loading}>
                                    {loading ? <div className="auth-spinner" /> : null}
                                    {loading ? 'Creating account…' : 'Create Account'}
                                </button>

                                <div className="auth-divider">or</div>

                                <button className="auth-btn-offline" onClick={handleOffline}>
                                    <IonIcon icon={cloudOfflineOutline} />
                                    Continue Offline
                                </button>
                            </>
                        )}

                        {/* ── CONFIRM OTP ── */}
                        {screen === 'confirm' && (
                            <>
                                <h2>Verify your email</h2>
                                <p className="auth-otp-note">
                                    We sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.
                                </p>

                                {error && (
                                    <div className="auth-error">
                                        <IonIcon icon={alertCircleOutline} />
                                        {error}
                                    </div>
                                )}
                                {resendMsg && (
                                    <div className="auth-error" style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)', color: '#86efac' }}>
                                        {resendMsg}
                                    </div>
                                )}

                                <div className="auth-field">
                                    <label>Verification Code</label>
                                    <div className="auth-input-wrapper">
                                        <IonIcon icon={lockClosedOutline} />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="123456"
                                            maxLength={6}
                                            value={confirmCode}
                                            onChange={e => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                                            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                                            autoComplete="one-time-code"
                                        />
                                    </div>
                                </div>

                                <button className="auth-btn-primary" onClick={handleConfirm} disabled={loading}>
                                    {loading ? <div className="auth-spinner" /> : null}
                                    {loading ? 'Verifying…' : 'Verify & Sign In'}
                                </button>

                                <button className="auth-resend" onClick={handleResend}>
                                    Didn't receive the code? Resend
                                </button>
                            </>
                        )}

                        {/* AWS not configured notice */}
                        {!awsEnabled && screen === 'signin' && (
                            <div className="auth-no-aws">
                                <IonIcon icon={alertCircleOutline} />
                                AWS not configured. Add your<br />
                                <code>VITE_COGNITO_*</code> env vars<br />
                                to enable cloud sync.
                            </div>
                        )}
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default AuthPage;
