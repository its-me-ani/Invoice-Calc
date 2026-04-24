/**
 * AWS Auth Service
 * Wraps Amplify v6 Cognito operations: signUp, confirmSignUp, signIn, signOut, getCurrentUser
 */

import {
    signUp as amplifySignUp,
    confirmSignUp as amplifyConfirmSignUp,
    signIn as amplifySignIn,
    signOut as amplifySignOut,
    getCurrentUser as amplifyGetCurrentUser,
    fetchAuthSession,
    resendSignUpCode,
    type SignUpOutput,
} from 'aws-amplify/auth';
import { isAwsConfigured } from './aws-config';

export interface AuthUser {
    userId: string;   // Cognito sub (UUID)
    email: string;
}

export interface AuthError {
    code: string;
    message: string;
}

function friendlyError(err: any): string {
    const msg: string = err?.message || String(err);
    if (msg.includes('User already exists')) return 'An account with this email already exists.';
    if (msg.includes('Incorrect username or password')) return 'Incorrect email or password.';
    if (msg.includes('User is not confirmed')) return 'Please verify your email before signing in.';
    if (msg.includes('Invalid verification code')) return 'Invalid or expired verification code.';
    if (msg.includes('Network error') || msg.includes('Failed to fetch')) return 'Network error. Check your connection.';
    return msg;
}

/**
 * Sign up a new user with email + password.
 * Returns { needsConfirmation: true } — user must enter OTP next.
 */
export async function signUpUser(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
    if (!isAwsConfigured()) throw new Error('AWS not configured');

    const result: SignUpOutput = await amplifySignUp({
        username: email,
        password,
        options: { 
            userAttributes: { 
                email, 
                name: email.split('@')[0]
            } 
        },
    });

    return { needsConfirmation: !result.isSignUpComplete };
}

/**
 * Confirm sign-up with the OTP code sent to the user's email.
 */
export async function confirmSignUpUser(email: string, code: string): Promise<void> {
    if (!isAwsConfigured()) throw new Error('AWS not configured');
    await amplifyConfirmSignUp({ username: email, confirmationCode: code });
}

/**
 * Resend confirmation code to the user's email.
 */
export async function resendConfirmationCode(email: string): Promise<void> {
    if (!isAwsConfigured()) throw new Error('AWS not configured');
    await resendSignUpCode({ username: email });
}

/**
 * Sign in with email + password.
 * Returns the authenticated user.
 */
export async function signInUser(email: string, password: string): Promise<AuthUser> {
    if (!isAwsConfigured()) throw new Error('AWS not configured');

    await amplifySignIn({ username: email, password });

    const user = await amplifyGetCurrentUser();
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.payload;

    return {
        userId: session.identityId || user.userId,
        email: (idToken?.email as string) || email,
    };
}

/**
 * Sign out the current user.
 */
export async function signOutUser(): Promise<void> {
    if (!isAwsConfigured()) return;
    await amplifySignOut();
}

/**
 * Get the currently signed-in user, or null if not signed in.
 */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
    if (!isAwsConfigured()) return null;

    try {
        const user = await amplifyGetCurrentUser();
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.payload;

        return {
            userId: session.identityId || user.userId,
            email: (idToken?.email as string) || user.username,
        };
    } catch {
        return null;
    }
}

/**
 * Get temporary AWS credentials for the current user (for DynamoDB / S3 access).
 */
export async function getAwsCredentials() {
    if (!isAwsConfigured()) return null;
    try {
        const session = await fetchAuthSession();
        return session.credentials ?? null;
    } catch {
        return null;
    }
}

export { friendlyError };
