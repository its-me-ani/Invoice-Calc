/**
 * DynamoDB Invoice Repository (Cloud)
 * Mirrors the localStorage repositories — same method names, same data shapes.
 * Uses Amplify v6 with Cognito Identity Pool credentials (no Lambda needed).
 *
 * Table design (single-table):
 *   PK = userId (Cognito sub)
 *   SK = {entityType}#{id}   e.g.  INV#invoice_123, CUST#customer_abc
 */

import {
    DynamoDBClient,
    PutItemCommand,
    GetItemCommand,
    QueryCommand,
    DeleteItemCommand,
    type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { fetchAuthSession } from 'aws-amplify/auth';
import { AWS_REGION, DYNAMO_TABLE, isAwsConfigured } from './aws-config';
import type { SavedInvoice, Customer, InventoryItem, BusinessAddress } from '../data/types';

// ─── Client Factory ──────────────────────────────────────────────────────────

async function getClient(): Promise<DynamoDBClient | null> {
    if (!isAwsConfigured()) return null;
    try {
        const session = await fetchAuthSession();
        const creds = session.credentials;
        if (!creds) return null;

        return new DynamoDBClient({
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

function sk(type: string, id: string) {
    return `${type}#${id}`;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const dynamoInvoiceRepository = {

    async saveInvoice(userId: string, invoice: SavedInvoice): Promise<boolean> {
        const client = await getClient();
        if (!client) return false;
        try {
            await client.send(new PutItemCommand({
                TableName: DYNAMO_TABLE,
                Item: marshall({
                    userId,
                    entityId: sk('INV', invoice.id),
                    ...invoice,
                    _entityType: 'INVOICE',
                }, { removeUndefinedValues: true }),
            }));
            return true;
        } catch (e) {
            console.error('[DynamoDB] saveInvoice failed:', e);
            return false;
        }
    },

    async getInvoices(userId: string): Promise<SavedInvoice[]> {
        const client = await getClient();
        if (!client) return [];
        try {
            const result = await client.send(new QueryCommand({
                TableName: DYNAMO_TABLE,
                KeyConditionExpression: 'userId = :uid AND begins_with(entityId, :prefix)',
                ExpressionAttributeValues: marshall({
                    ':uid': userId,
                    ':prefix': 'INV#',
                }),
            }));
            return (result.Items || []).map(item => {
                const obj = unmarshall(item as Record<string, AttributeValue>);
                delete obj.userId; delete obj.entityId; delete obj._entityType;
                return obj as SavedInvoice;
            });
        } catch (e) {
            console.error('[DynamoDB] getInvoices failed:', e);
            return [];
        }
    },

    async getInvoice(userId: string, invoiceId: string): Promise<SavedInvoice | null> {
        const client = await getClient();
        if (!client) return null;
        try {
            const result = await client.send(new GetItemCommand({
                TableName: DYNAMO_TABLE,
                Key: marshall({
                    userId,
                    entityId: sk('INV', invoiceId),
                }),
            }));
            if (!result.Item) return null;
            const obj = unmarshall(result.Item as Record<string, AttributeValue>);
            delete obj.userId; delete obj.entityId; delete obj._entityType;
            return obj as SavedInvoice;
        } catch (e) {
            console.error('[DynamoDB] getInvoice failed:', e);
            return null;
        }
    },

    async deleteInvoice(userId: string, invoiceId: string): Promise<boolean> {
        const client = await getClient();
        if (!client) return false;
        try {
            await client.send(new DeleteItemCommand({
                TableName: DYNAMO_TABLE,
                Key: marshall({ userId, entityId: sk('INV', invoiceId) }),
            }));
            return true;
        } catch (e) {
            console.error('[DynamoDB] deleteInvoice failed:', e);
            return false;
        }
    },
};

// ─── Customers ────────────────────────────────────────────────────────────────

export const dynamoCustomerRepository = {

    async saveCustomer(userId: string, customer: Customer): Promise<boolean> {
        const client = await getClient();
        if (!client) return false;
        try {
            await client.send(new PutItemCommand({
                TableName: DYNAMO_TABLE,
                Item: marshall({ userId, entityId: sk('CUST', customer.id), ...customer, _entityType: 'CUSTOMER' }, { removeUndefinedValues: true }),
            }));
            return true;
        } catch (e) {
            console.error('[DynamoDB] saveCustomer failed:', e);
            return false;
        }
    },

    async getCustomers(userId: string): Promise<Customer[]> {
        const client = await getClient();
        if (!client) return [];
        try {
            const result = await client.send(new QueryCommand({
                TableName: DYNAMO_TABLE,
                KeyConditionExpression: 'userId = :uid AND begins_with(entityId, :prefix)',
                ExpressionAttributeValues: marshall({ ':uid': userId, ':prefix': 'CUST#' }),
            }));
            return (result.Items || []).map(item => {
                const obj = unmarshall(item as Record<string, AttributeValue>);
                delete obj.userId; delete obj.entityId; delete obj._entityType;
                return obj as Customer;
            });
        } catch (e) {
            console.error('[DynamoDB] getCustomers failed:', e);
            return [];
        }
    },

    async deleteCustomer(userId: string, customerId: string): Promise<boolean> {
        const client = await getClient();
        if (!client) return false;
        try {
            await client.send(new DeleteItemCommand({
                TableName: DYNAMO_TABLE,
                Key: marshall({ userId, entityId: sk('CUST', customerId) }),
            }));
            return true;
        } catch (e) {
            console.error('[DynamoDB] deleteCustomer failed:', e);
            return false;
        }
    },
};

// ─── Inventory ────────────────────────────────────────────────────────────────

export const dynamoInventoryRepository = {

    async saveItem(userId: string, item: InventoryItem): Promise<boolean> {
        const client = await getClient();
        if (!client) return false;
        try {
            await client.send(new PutItemCommand({
                TableName: DYNAMO_TABLE,
                Item: marshall({ userId, entityId: sk('ITEM', item.id), ...item, _entityType: 'INVENTORY' }, { removeUndefinedValues: true }),
            }));
            return true;
        } catch (e) {
            console.error('[DynamoDB] saveItem failed:', e);
            return false;
        }
    },

    async getItems(userId: string): Promise<InventoryItem[]> {
        const client = await getClient();
        if (!client) return [];
        try {
            const result = await client.send(new QueryCommand({
                TableName: DYNAMO_TABLE,
                KeyConditionExpression: 'userId = :uid AND begins_with(entityId, :prefix)',
                ExpressionAttributeValues: marshall({ ':uid': userId, ':prefix': 'ITEM#' }),
            }));
            return (result.Items || []).map(item => {
                const obj = unmarshall(item as Record<string, AttributeValue>);
                delete obj.userId; delete obj.entityId; delete obj._entityType;
                return obj as InventoryItem;
            });
        } catch (e) {
            console.error('[DynamoDB] getItems failed:', e);
            return [];
        }
    },
};

// ─── Business Info ────────────────────────────────────────────────────────────

export const dynamoBusinessInfoRepository = {

    async saveAddress(userId: string, address: BusinessAddress): Promise<boolean> {
        const client = await getClient();
        if (!client) return false;
        try {
            await client.send(new PutItemCommand({
                TableName: DYNAMO_TABLE,
                Item: marshall({ userId, entityId: sk('ADDR', address.id), ...address, _entityType: 'ADDRESS' }, { removeUndefinedValues: true }),
            }));
            return true;
        } catch (e) {
            console.error('[DynamoDB] saveAddress failed:', e);
            return false;
        }
    },

    async getAddresses(userId: string): Promise<BusinessAddress[]> {
        const client = await getClient();
        if (!client) return [];
        try {
            const result = await client.send(new QueryCommand({
                TableName: DYNAMO_TABLE,
                KeyConditionExpression: 'userId = :uid AND begins_with(entityId, :prefix)',
                ExpressionAttributeValues: marshall({ ':uid': userId, ':prefix': 'ADDR#' }),
            }));
            return (result.Items || []).map(item => {
                const obj = unmarshall(item as Record<string, AttributeValue>);
                delete obj.userId; delete obj.entityId; delete obj._entityType;
                return obj as BusinessAddress;
            });
        } catch (e) {
            console.error('[DynamoDB] getAddresses failed:', e);
            return [];
        }
    },
};
