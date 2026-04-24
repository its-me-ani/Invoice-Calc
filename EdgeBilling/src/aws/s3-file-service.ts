/**
 * S3 File Service
 * Handles upload and retrieval of:
 *   - Invoice spreadsheet content  → invoices/{userId}/{invoiceId}.json
 *   - Logo images (base64 → PNG)   → logos/{userId}/{logoId}.png
 *   - Signature images              → signatures/{userId}/{sigId}.png
 *
 * Uses Amplify Identity Pool credentials — no Lambda, no API Gateway.
 */

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fetchAuthSession } from 'aws-amplify/auth';
import { AWS_REGION, S3_BUCKET, isAwsConfigured } from './aws-config';

// ─── Client factory ──────────────────────────────────────────────────────────

async function getClient(): Promise<S3Client | null> {
    if (!isAwsConfigured()) return null;
    try {
        const session = await fetchAuthSession();
        const creds = session.credentials;
        if (!creds) return null;

        return new S3Client({
            region: AWS_REGION,
            credentials: {
                accessKeyId: creds.accessKeyId,
                secretAccessKey: creds.secretAccessKey,
                sessionToken: creds.sessionToken,
            },
        });
    } catch {
        return null;
    }
}

/** Convert a base64 data URL to a Uint8Array for S3 upload */
function base64ToUint8Array(dataUrl: string): Uint8Array {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** Get content type from data URL or filename */
function getContentType(dataUrl: string): string {
    if (dataUrl.startsWith('data:image/png')) return 'image/png';
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'image/jpeg';
    if (dataUrl.startsWith('data:image/webp')) return 'image/webp';
    return 'image/png';
}

// ─── Invoice Content ──────────────────────────────────────────────────────────

/**
 * Upload SocialCalc spreadsheet content string to S3.
 * Key: invoices/{userId}/{invoiceId}.json
 */
export async function uploadInvoiceContent(
    userId: string,
    invoiceId: string,
    content: string
): Promise<boolean> {
    const client = await getClient();
    if (!client) return false;
    try {
        await client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${userId}/invoices/${invoiceId}.json`,
            Body: content,
            ContentType: 'application/json',
        }));
        return true;
    } catch (e) {
        console.error('[S3] uploadInvoiceContent failed:', e);
        return false;
    }
}

/**
 * Download invoice content string from S3.
 */
export async function getInvoiceContent(
    userId: string,
    invoiceId: string
): Promise<string | null> {
    const client = await getClient();
    if (!client) return null;
    try {
        const result = await client.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${userId}/invoices/${invoiceId}.json`,
        }));
        return await result.Body?.transformToString() ?? null;
    } catch (e) {
        console.error('[S3] getInvoiceContent failed:', e);
        return null;
    }
}

/**
 * Delete invoice content from S3.
 */
export async function deleteInvoiceContent(userId: string, invoiceId: string): Promise<boolean> {
    const client = await getClient();
    if (!client) return false;
    try {
        await client.send(new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${userId}/invoices/${invoiceId}.json`,
        }));
        return true;
    } catch (e) {
        console.error('[S3] deleteInvoiceContent failed:', e);
        return false;
    }
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

/**
 * Upload a logo (base64 data URL) to S3.
 * Key: logos/{userId}/{logoId}.png
 */
export async function uploadLogo(
    userId: string,
    logoId: string,
    base64DataUrl: string
): Promise<boolean> {
    const client = await getClient();
    if (!client) return false;
    try {
        await client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${userId}/logos/${logoId}.png`,
            Body: base64ToUint8Array(base64DataUrl),
            ContentType: getContentType(base64DataUrl),
        }));
        return true;
    } catch (e) {
        console.error('[S3] uploadLogo failed:', e);
        return false;
    }
}

/**
 * Get a presigned URL for a logo (valid 15 minutes).
 */
export async function getLogoUrl(userId: string, logoId: string): Promise<string | null> {
    const client = await getClient();
    if (!client) return null;
    try {
        return await getSignedUrl(
            client,
            new GetObjectCommand({ Bucket: S3_BUCKET, Key: `${userId}/logos/${logoId}.png` }),
            { expiresIn: 900 }
        );
    } catch (e) {
        console.error('[S3] getLogoUrl failed:', e);
        return null;
    }
}

// ─── Signature ────────────────────────────────────────────────────────────────

/**
 * Upload a signature (base64 data URL) to S3.
 * Key: signatures/{userId}/{sigId}.png
 */
export async function uploadSignature(
    userId: string,
    sigId: string,
    base64DataUrl: string
): Promise<boolean> {
    const client = await getClient();
    if (!client) return false;
    try {
        await client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${userId}/signatures/${sigId}.png`,
            Body: base64ToUint8Array(base64DataUrl),
            ContentType: getContentType(base64DataUrl),
        }));
        return true;
    } catch (e) {
        console.error('[S3] uploadSignature failed:', e);
        return false;
    }
}

/**
 * Get a presigned URL for a signature (valid 15 minutes).
 */
export async function getSignatureUrl(userId: string, sigId: string): Promise<string | null> {
    const client = await getClient();
    if (!client) return null;
    try {
        return await getSignedUrl(
            client,
            new GetObjectCommand({ Bucket: S3_BUCKET, Key: `${userId}/signatures/${sigId}.png` }),
            { expiresIn: 900 }
        );
    } catch (e) {
        console.error('[S3] getSignatureUrl failed:', e);
        return null;
    }
}
