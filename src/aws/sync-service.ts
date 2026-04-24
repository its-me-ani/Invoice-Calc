/**
 * AWS Sync Service
 * Bi-directional sync between localStorage and AWS (DynamoDB + S3).
 *
 * Strategy:
 *  - pullFromCloud(): on login, fetch all cloud data and merge into localStorage
 *  - pushToCloud():   after a local save, write to DynamoDB + S3 in background
 *  - Offline queue:   failed cloud writes are stored and retried later
 */

import {
    dynamoInvoiceRepository,
    dynamoCustomerRepository,
    dynamoInventoryRepository,
    dynamoBusinessInfoRepository,
} from './dynamo-invoice-repository';
import { uploadInvoiceContent, uploadLogo, uploadSignature } from './s3-file-service';
import { invoiceRepository, customerRepository, inventoryRepository, businessInfoRepository } from '../data';
import type { SavedInvoice } from '../data/types';

const SYNC_QUEUE_KEY = 'aws_sync_queue';
const CLOUD_USER_KEY = 'aws_cloud_userId';

// ─── Queue helpers ────────────────────────────────────────────────────────────

interface SyncQueueItem {
    type: 'invoice' | 'customer' | 'inventory' | 'address' | 'logo' | 'signature';
    action: 'save' | 'delete';
    id: string;
    userId: string;
    payload?: any;
}

export function getQueue(): SyncQueueItem[] {
    try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]'); } catch { return []; }
}

export function saveQueue(queue: SyncQueueItem[]): void {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(item: SyncQueueItem): void {
    const queue = getQueue();
    // Deduplicate: remove older item with same type+id+action
    const deduped = queue.filter(q => !(q.type === item.type && q.id === item.id && q.action === item.action));
    deduped.push(item);
    saveQueue(deduped);
}

export function removeFromQueue(type: string, action: string, id: string): void {
    const queue = getQueue();
    const newQueue = queue.filter(q => !(q.type === type && q.action === action && q.id === id));
    saveQueue(newQueue);
}

export function clearOfflineInvoices(): void {
    const queue = getQueue();
    const newQueue = queue.filter(q => q.type !== 'invoice');
    saveQueue(newQueue);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pull all cloud data into localStorage.
 * Called once after successful sign-in.
 * Cloud wins on conflict (newer modifiedAt wins for invoices).
 */
export async function pullFromCloud(userId: string): Promise<{ invoices: number; customers: number; inventory: number }> {
    let invoiceCount = 0, customerCount = 0, inventoryCount = 0;

    // Store the userId so we know which cloud account is synced
    localStorage.setItem(CLOUD_USER_KEY, userId);

    try {
        // ── Invoices ──────────────────────────────────────────────────────────
        const cloudInvoices = await dynamoInvoiceRepository.getInvoices(userId);
        const localInvoices = await invoiceRepository.getAllInvoices();

        for (const cloudInv of cloudInvoices) {
            const local = localInvoices.find(l => l.id === cloudInv.id);
            if (!local || new Date(cloudInv.modifiedAt) > new Date(local.modifiedAt)) {
                await invoiceRepository.saveInvoice(cloudInv);
                invoiceCount++;
            }
        }

        // ── Customers ─────────────────────────────────────────────────────────
        const cloudCustomers = await dynamoCustomerRepository.getCustomers(userId);
        const localCustomers = await customerRepository.getAll();

        for (const cc of cloudCustomers) {
            const local = localCustomers.find(l => l.id === cc.id);
            if (!local || new Date(cc.updatedAt || 0) > new Date(local.updatedAt || 0)) {
                await customerRepository.save(cc);
                customerCount++;
            }
        }

        // ── Inventory ─────────────────────────────────────────────────────────
        const cloudItems = await dynamoInventoryRepository.getItems(userId);
        const localItems = await inventoryRepository.getAll();

        for (const ci of cloudItems) {
            const local = localItems.find(l => l.id === ci.id);
            if (!local || new Date(ci.updatedAt || 0) > new Date(local.updatedAt || 0)) {
                await inventoryRepository.save(ci);
                inventoryCount++;
            }
        }

        // ── Business Addresses ────────────────────────────────────────────────
        const cloudAddresses = await dynamoBusinessInfoRepository.getAddresses(userId);
        for (const ca of cloudAddresses) {
            const localAddrs = await businessInfoRepository.getAllAddresses();
            if (!localAddrs.find(l => l.id === ca.id)) {
                await businessInfoRepository.saveAddress(ca);
            }
        }

        console.log(`[Sync] Pulled from cloud — invoices: ${invoiceCount}, customers: ${customerCount}, inventory: ${inventoryCount}`);
    } catch (e) {
        console.error('[Sync] pullFromCloud failed:', e);
    }

    return { invoices: invoiceCount, customers: customerCount, inventory: inventoryCount };
}

/**
 * Push a saved invoice to cloud (DynamoDB metadata + S3 content).
 * Non-blocking: if network fails, enqueues for retry.
 */
export async function pushInvoiceToCloud(userId: string, invoice: SavedInvoice): Promise<void> {
    try {
        const [metaOk, fileOk] = await Promise.all([
            dynamoInvoiceRepository.saveInvoice(userId, invoice),
            uploadInvoiceContent(userId, invoice.id, invoice.content),
        ]);

        if (!metaOk || !fileOk) throw new Error('partial failure');
        console.log('[Sync] Invoice pushed to cloud:', invoice.id);
        removeFromQueue('invoice', 'save', invoice.id);
    } catch {
        // Queue for retry
        enqueue({ type: 'invoice', action: 'save', id: invoice.id, userId, payload: invoice });
        console.warn('[Sync] Invoice queued for retry:', invoice.id);
    }
}

/**
 * Push a logo upload to cloud.
 * Non-blocking with offline queue fallback.
 */
export async function pushLogoToCloud(userId: string, logoId: string, base64DataUrl: string): Promise<void> {
    try {
        const ok = await uploadLogo(userId, logoId, base64DataUrl);
        if (!ok) throw new Error('upload failed');
        removeFromQueue('logo', 'save', logoId);
    } catch {
        enqueue({ type: 'logo', action: 'save', id: logoId, userId, payload: base64DataUrl });
    }
}

/**
 * Push a signature upload to cloud.
 */
export async function pushSignatureToCloud(userId: string, sigId: string, base64DataUrl: string): Promise<void> {
    try {
        const ok = await uploadSignature(userId, sigId, base64DataUrl);
        if (!ok) throw new Error('upload failed');
        removeFromQueue('signature', 'save', sigId);
    } catch {
        enqueue({ type: 'signature', action: 'save', id: sigId, userId, payload: base64DataUrl });
    }
}

/**
 * Flush the offline sync queue — retry all pending writes.
 * Call this when the app regains network connectivity.
 */
export async function flushSyncQueue(): Promise<void> {
    const queue = getQueue();
    if (queue.length === 0) return;

    const remaining: SyncQueueItem[] = [];

    for (const item of queue) {
        try {
            if (item.type === 'invoice' && item.action === 'save') {
                await dynamoInvoiceRepository.saveInvoice(item.userId, item.payload);
                await uploadInvoiceContent(item.userId, item.id, item.payload.content);
            } else if (item.type === 'logo' && item.action === 'save') {
                await uploadLogo(item.userId, item.id, item.payload);
            } else if (item.type === 'signature' && item.action === 'save') {
                await uploadSignature(item.userId, item.id, item.payload);
            } else if (item.type === 'customer' && item.action === 'save') {
                await dynamoCustomerRepository.saveCustomer(item.userId, item.payload);
            }
            console.log('[Sync] Queue item flushed:', item.type, item.id);
        } catch {
            remaining.push(item); // keep failed items
        }
    }

    saveQueue(remaining);
    if (remaining.length > 0) {
        console.warn('[Sync] Sync queue still has', remaining.length, 'pending items');
    }
}

/**
 * Returns the userId of the currently synced cloud account, or null.
 */
export function getSyncedUserId(): string | null {
    return localStorage.getItem(CLOUD_USER_KEY);
}

/**
 * Clear the synced user marker (called on sign-out).
 */
export function clearSyncedUser(): void {
    localStorage.removeItem(CLOUD_USER_KEY);
    localStorage.removeItem(SYNC_QUEUE_KEY);
}
