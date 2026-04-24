/**
 * AWS Amplify Configuration
 * Reads values from VITE_ env vars — fill in .env after running aws-setup-guide.md
 */

import { Amplify } from 'aws-amplify';

const region = import.meta.env.VITE_AWS_REGION as string;
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID as string;

export const DYNAMO_TABLE = import.meta.env.VITE_DYNAMO_TABLE as string || 'edgebilling-dev';
export const S3_BUCKET = import.meta.env.VITE_S3_BUCKET as string || 'edgebilling-files-dev';
export const AWS_REGION = region || 'ap-south-1';

/**
 * Returns true if AWS env vars are configured (not placeholder values)
 */
export function isAwsConfigured(): boolean {
    return !!(
        region &&
        userPoolId &&
        !userPoolId.includes('XXXXXXXXX') &&
        userPoolClientId &&
        !userPoolClientId.includes('XXXXXXXXX') &&
        identityPoolId &&
        !identityPoolId.includes('XXXXXXXX')
    );
}

/**
 * Configure Amplify — call this once at app startup (main.tsx)
 */
export function configureAmplify(): void {
    if (!isAwsConfigured()) {
        console.warn('[AWS] Env vars not configured — AWS features disabled. Fill in .env to enable cloud sync.');
        return;
    }

    Amplify.configure({
        Auth: {
            Cognito: {
                userPoolId,
                userPoolClientId,
                identityPoolId,
                loginWith: {
                    email: true,
                },
            },
        },
    });

    console.log('[AWS] Amplify configured for region:', region);
}
