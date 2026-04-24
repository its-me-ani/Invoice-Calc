/**
 * useAuth — React hook for AWS Cognito authentication.
 * Provides: user, loading, signIn, signUp, confirmSignUp, signOut, continueOffline
 */

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import {
    getCurrentAuthUser,
    signInUser,
    signUpUser,
    confirmSignUpUser,
    signOutUser,
    resendConfirmationCode,
    friendlyError,
    type AuthUser,
} from '../aws/auth-service';
import { pullFromCloud, clearSyncedUser } from '../aws/sync-service';
import { isAwsConfigured } from '../aws/aws-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthMode = 'loading' | 'unauthenticated' | 'offline' | 'authenticated';

interface AuthState {
    user: AuthUser | null;
    mode: AuthMode;
    awsEnabled: boolean;
}

interface AuthContextValue extends AuthState {
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
    confirmSignUp: (email: string, code: string) => Promise<void>;
    resendCode: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    continueOffline: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const OFFLINE_KEY = 'edgebilling_offline_mode';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [mode, setMode] = useState<AuthMode>('loading');
    const awsEnabled = isAwsConfigured();

    // ── Bootstrap: check for existing session ─────────────────────────────────
    useEffect(() => {
        const init = async () => {
            // If AWS not configured, always go offline
            if (!awsEnabled) { setMode('offline'); return; }

            // If user chose offline before, respect that
            if (localStorage.getItem(OFFLINE_KEY) === 'true') { setMode('offline'); return; }

            const currentUser = await getCurrentAuthUser();
            if (currentUser) {
                setUser(currentUser);
                setMode('authenticated');
                // Background sync — don't block UI
                pullFromCloud(currentUser.userId).catch(console.error);
            } else {
                setMode('unauthenticated');
            }
        };
        init();
    }, [awsEnabled]);

    // ── Sign In ───────────────────────────────────────────────────────────────
    const signIn = useCallback(async (email: string, password: string) => {
        const authUser = await signInUser(email, password);
        setUser(authUser);
        setMode('authenticated');
        localStorage.removeItem(OFFLINE_KEY);
        // Pull cloud data in background
        pullFromCloud(authUser.userId).catch(console.error);
    }, []);

    // ── Sign Up ───────────────────────────────────────────────────────────────
    const signUp = useCallback(async (email: string, password: string) => {
        return await signUpUser(email, password);
    }, []);

    // ── Confirm Sign Up ───────────────────────────────────────────────────────
    const confirmSignUp = useCallback(async (email: string, code: string) => {
        await confirmSignUpUser(email, code);
    }, []);

    // ── Resend Code ───────────────────────────────────────────────────────────
    const resendCode = useCallback(async (email: string) => {
        await resendConfirmationCode(email);
    }, []);

    // ── Sign Out ──────────────────────────────────────────────────────────────
    const signOut = useCallback(async () => {
        await signOutUser();
        clearSyncedUser();
        setUser(null);
        setMode('unauthenticated');
    }, []);

    // ── Continue Offline ──────────────────────────────────────────────────────
    const continueOffline = useCallback(() => {
        localStorage.setItem(OFFLINE_KEY, 'true');
        setMode('offline');
    }, []);

    return (
        <AuthContext.Provider value={{ user, mode, awsEnabled, signIn, signUp, confirmSignUp, resendCode, signOut, continueOffline }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}

export { friendlyError };
