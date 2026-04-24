# EdgeBilling — AWS Cloud Architecture Design

> **Project**: EdgeBilling · Local Invoice AI  
> **Stack**: Ionic React (Capacitor) · TypeScript · AWS  
> **Date**: April 2026  

---

## 1. Current Architecture (Local / Offline)

EdgeBilling is presently a **fully offline-first Ionic/Capacitor app**. All persistence is `localStorage`-backed via a thin repository layer.

### Current Data Entities & Storage Keys

| Entity | localStorage Key | Repository |
|---|---|---|
| Invoices | `app_invoices` | `invoiceRepository` |
| User Templates | `app_user_templates` | `invoiceRepository` |
| Customers | `app_customers` | `customerRepository` |
| Inventory Items | `app_inventory_items` | `inventoryRepository` |
| Business Addresses | `app_business_addresses` | `businessInfoRepository` |
| Signatures (base64) | `app_signatures` | `businessInfoRepository` |
| Logos (base64) | `app_logos` | `businessInfoRepository` |
| Active Template ID | `stark-invoice-active-template-id` | localStorage direct |

### Current Limitations
- Hard limit of **8 invoices** per device
- No cross-device sync
- No user identity / multi-tenancy
- No cloud backup or invoice sharing
- AI inference uses local Ollama or user-supplied OpenAI key

---

## 2. AWS Target Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                         │
│   Ionic/Capacitor App (iOS · Android · Web)              │
│   JWT via Cognito · Offline-first with sync queue        │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS / REST + WebSocket
┌──────────────────────▼───────────────────────────────────┐
│              API & AUTH LAYER                            │
│  Amazon API Gateway (REST + WebSocket)                   │
│  Amazon Cognito User Pools (Auth + JWT)                  │
│  AWS WAF · CloudFront (CDN for app + assets)             │
└──┬──────────────┬──────────────┬──────────────┬──────────┘
   │              │              │              │
┌──▼───┐    ┌─────▼─────┐  ┌────▼──────┐  ┌───▼────────┐
│Lambda│    │  Lambda   │  │  Lambda   │  │  Lambda    │
│ Auth │    │  Invoice  │  │ Inventory │  │  AI Agent  │
└──┬───┘    └─────┬─────┘  └────┬──────┘  └───┬────────┘
   │              │              │              │
┌──▼──────────────▼──────────────▼──────────────▼─────────┐
│                    DATA LAYER                            │
│  DynamoDB  ·  S3  ·  OpenSearch  ·  ElastiCache Redis   │
│  Bedrock / SageMaker (LLM inference)                    │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Service-by-Service Design

### 3.1 Identity & Authentication — Amazon Cognito

**What it replaces**: `userId = 'offline_user'` hardcoded in `InvoicePage.tsx`

```
Cognito User Pool
  ├── Sign-up / Sign-in (email + password, Google OAuth)
  ├── MFA (optional TOTP)
  ├── JWT Access Token (15 min TTL)
  ├── JWT Refresh Token (30 day TTL)
  └── User Attributes: email, businessName, plan (free/pro)

Cognito Identity Pool
  └── Federated identity → scoped IAM role for S3 presigned URLs
```

**User Profile in DynamoDB** `users` table:
```json
{
  "userId": "cognito-sub-uuid",
  "email": "user@example.com",
  "businessName": "Acme Corp",
  "plan": "pro",
  "currency": "INR",
  "createdAt": "2026-04-22T00:00:00Z",
  "onboardingCompleted": true,
  "settings": {
    "defaultTemplateId": "100001",
    "aiProvider": "bedrock",
    "aiModel": "claude-3-haiku"
  }
}
```

---

### 3.2 Primary Database — Amazon DynamoDB (Single-Table Design)

**Table Name**: `edgebilling-{env}`

#### Key Schema

| Entity | PK | SK | GSI |
|---|---|---|---|
| User Profile | `USER#{userId}` | `#PROFILE` | — |
| Invoice | `USER#{userId}` | `INV#{invoiceId}` | GSI1: templateId + createdAt |
| Customer | `USER#{userId}` | `CUST#{customerId}` | GSI1: email |
| Inventory Item | `USER#{userId}` | `ITEM#{itemId}` | — |
| Business Address | `USER#{userId}` | `ADDR#{addressId}` | — |
| Signature | `USER#{userId}` | `SIG#{signatureId}` | — |
| Logo | `USER#{userId}` | `LOGO#{logoId}` | — |
| User Template | `USER#{userId}` | `TMPL#{templateId}` | — |

**Invoice Item Shape** (maps from `SavedInvoice` in `types.ts`):
```json
{
  "PK": "USER#abc123",
  "SK": "INV#invoice_1714000000000",
  "id": "invoice_1714000000000",
  "name": "Invoice #001",
  "templateId": "100001",
  "billType": 0,
  "total": 25000,
  "invoiceNumber": "INV-2026-001",
  "invoiceDate": "2026-04-22",
  "s3Key": "invoices/abc123/invoice_1714000000000.json",
  "pdfS3Key": "pdfs/abc123/invoice_1714000000000.pdf",
  "fromDetails": { "CompanyName": "Acme Corp" },
  "billToDetails": { "Name": "Client Name", "Email": "client@example.com" },
  "items": [{ "rowNumber": 1, "cells": { "Description": "Web Dev", "Amount": 25000 } }],
  "keywords": ["web dev", "client name", "acme"],
  "createdAt": "2026-04-22T00:00:00Z",
  "modifiedAt": "2026-04-22T00:00:00Z",
  "entityType": "INVOICE"
}
```

**DynamoDB Settings**: On-Demand billing · PITR enabled · DynamoDB Streams → OpenSearch sync

---

### 3.3 File & Asset Storage — Amazon S3

```
edgebilling-assets-{env}/
├── invoices/{userId}/{invoiceId}.json        ← SocialCalc spreadsheet content
├── pdfs/{userId}/{invoiceId}.pdf             ← Exported PDFs
├── logos/{userId}/{logoId}.png               ← Business logos (replaces base64 in DB)
├── signatures/{userId}/{sigId}.png           ← Signatures (replaces base64 in DB)
├── templates/
│   ├── meta/{id}-meta.json                   ← Template metadata (CDN cached)
│   ├── data/{id}.json                        ← Template spreadsheet data
│   └── thumbnails/{id}.webp                  ← Preview images
├── exports/{userId}/batch_{ts}.zip           ← Bulk PDF exports
└── invoice-metadata/{userId}/{invoiceId}/
    ├── keywords.json                         ← Extracted: customer, items, amounts
    ├── embedding.json                        ← Vector embedding of invoice summary
    └── summary.txt                           ← LLM-generated summary (for Agent RAG)
```

**S3 Config**: Versioning on `invoices/` · Presigned URLs (15 min TTL) · CloudFront OAC for templates · S3-IA lifecycle after 30 days for exports

---

### 3.4 Invoice Search + AI Vector Store — Amazon OpenSearch

Two index types power both keyword search and the Invoice Agent:

#### A. Full-Text Search Index: `invoices`
```json
{
  "userId": "keyword",
  "invoiceId": "keyword",
  "invoiceName": "text (standard analyzer)",
  "customerName": "text",
  "invoiceNumber": "keyword",
  "invoiceDate": "date",
  "total": "float",
  "keywords": "text",
  "items": "text",
  "status": "keyword"
}
```

#### B. Vector Embedding Index: `invoice-embeddings` (RAG)
```json
{
  "userId": "keyword",
  "invoiceId": "keyword",
  "chunkText": "text",
  "embedding": { "type": "knn_vector", "dimension": 1536, "method": "hnsw" },
  "metadata": "object"
}
```

**Sync**: DynamoDB Streams → Lambda → OpenSearch (near real-time)

---

### 3.5 LLM Inference — Invoice AI Agent (Bedrock)

The existing `ai-provider.ts` (Ollama + OpenAI-compatible) gains **Amazon Bedrock** as the primary cloud backend.

```
Client → API Gateway → Lambda (AI Agent Handler)
                           ↓
                     Bedrock Runtime (Claude 3 Haiku/Sonnet)
                           ↓
                     OpenSearch (kNN RAG retrieval)
                           ↓
                     Response → Client
```

**Models**:
| Model | Use Case | Cost |
|---|---|---|
| `anthropic.claude-3-haiku` | Default (fast, cheap) | ~$0.25/1M tokens |
| `anthropic.claude-3-sonnet` | Complex analysis | ~$3/1M tokens |
| `amazon.titan-embed-text-v2` | Generate embeddings | ~$0.10/1M tokens |

**Agent Modes** (maps to `ai-context-builder.ts`):

| Mode | Action |
|---|---|
| `summarize` | Describe invoice with Bedrock Claude |
| `edit` | Modify cell values via JSON actions |
| `analyze` | Validate invoice for errors |
| `format` | Fix spelling/formatting |
| `search` | Natural language → OpenSearch kNN → response |

**RAG Pipeline**:
```
User: "Show invoices for Acme Corp over ₹10,000"
  → Embed query (Bedrock Titan)
  → OpenSearch kNN search (invoice-embeddings)
  → Retrieve top-5 invoice chunks + metadata
  → Build context prompt
  → Bedrock Claude → structured response
```

**Optional: SageMaker** for fine-tuned domain models on invoice data (`ml.g4dn.xlarge`).

---

### 3.6 API Layer — API Gateway + Lambda

```
POST /auth/signup | /auth/login | /auth/refresh

GET|POST         /invoices
GET|PUT|DELETE   /invoices/{id}
GET              /invoices/{id}/presign     ← S3 presigned URL

GET|POST         /customers
PUT|DELETE       /customers/{id}

GET|POST         /inventory
PUT|DELETE       /inventory/{id}

GET|POST         /business/addresses
GET|POST         /business/signatures
GET|POST         /business/logos

GET              /templates
GET              /templates/{id}

POST             /ai/chat                  ← Streaming AI response
POST             /ai/search                ← Semantic invoice search
POST             /ai/analyze/{invoiceId}   ← Single invoice analysis

GET|PUT          /user/profile
GET|PUT          /user/settings
```

**Lambda Config**: Node.js 20.x · ARM64 · 256–512 MB · 30s timeout (sync) · 15 min (AI/batch)

---

### 3.7 Caching — ElastiCache Redis

```
session:{userId}           → user profile JSON         TTL: 5 min
templates:list             → template store listing    TTL: 1 hour
template:{id}:meta         → single template meta      TTL: 24 hours
ratelimit:{userId}:ai      → AI request count          TTL: 1 hour (max 50/hr)
invoice:count:{userId}     → cached invoice count      TTL: 30 sec
```

---

### 3.8 CDN — CloudFront

```
CloudFront Distribution
├── Origin 1: S3 (app static files)        → /app/*
├── Origin 2: S3 (template thumbnails)     → /templates/*  cache: 7 days
└── Origin 3: API Gateway                  → /api/*        no cache
```

---

## 4. Cost Analysis

### Budget Tier — ~50 MAU, 500 invoices/month

| Service | Config | Monthly Cost |
|---|---|---|
| Cognito | 50 MAU (free ≤ 50K) | **$0.00** |
| DynamoDB | On-demand, ~100K R/W | **$0.25** |
| S3 | 5 GB + 10K requests | **$0.15** |
| Lambda | 500K invocations | **$0.10** |
| API Gateway | 500K REST calls | **$1.75** |
| OpenSearch Serverless | 2 OCU min | **$175.00** |
| Bedrock Claude Haiku | ~100K tokens | **$0.25** |
| ElastiCache | cache.t3.micro | **$12.00** |
| CloudFront | 10 GB | **$0.85** |
| CloudWatch | 5 GB logs | **$2.50** |
| **Total** | | **~$193/month** |

> [!WARNING]
> OpenSearch Serverless dominates cost at small scale (~$175/mo). For MVP, replace with **DynamoDB GSI search + Bedrock embeddings stored in S3**. Estimated cost drops to **$20–25/month**.

---

### Recommended Tier — ~500 MAU, 10K invoices/month

| Service | Config | Monthly Cost |
|---|---|---|
| Cognito | 500 MAU (free) | **$0.00** |
| DynamoDB | On-demand, ~5M R/W | **$6.50** |
| S3 | 50 GB + 500K requests | **$1.35** |
| Lambda | 5M invocations, 512MB | **$1.80** |
| API Gateway | 5M calls | **$17.50** |
| OpenSearch Serverless | 4 OCU | **$350.00** |
| Bedrock Claude Haiku | ~2M tokens | **$5.00** |
| Bedrock Titan Embed | ~500K tokens | **$0.05** |
| ElastiCache | cache.r6g.large | **$110.00** |
| CloudFront | 100 GB | **$8.50** |
| CloudWatch + X-Ray | Monitoring | **$10.00** |
| Secrets Manager | 5 secrets | **$2.00** |
| **Total** | | **~$513/month** |

---

### Enterprise Tier — ~5K MAU, 100K invoices/month

| Service | Config | Monthly Cost |
|---|---|---|
| Cognito | 5K MAU | **$22.50** |
| DynamoDB | Provisioned 5K RCU / 2K WCU | **$65.00** |
| DynamoDB DAX | dax.t3.medium | **$45.00** |
| S3 | 500 GB + 5M requests | **$13.00** |
| Lambda | 50M invocations | **$10.00** |
| API Gateway | 50M calls | **$175.00** |
| OpenSearch | r6g.large.search (3 nodes) | **$300.00** |
| Bedrock Claude Sonnet | ~20M tokens | **$120.00** |
| SageMaker Endpoint | ml.g4dn.xlarge | **$360.00** |
| ElastiCache | r6g.large cluster (2 nodes) | **$220.00** |
| CloudFront | 1 TB | **$85.00** |
| WAF | 10M requests | **$20.00** |
| Monitoring | CloudWatch + X-Ray | **$50.00** |
| **Total** | | **~$1,486/month** |

---

### Cost Optimization Tips

1. **Skip OpenSearch for MVP** — Use DynamoDB GSIs until >1K MAU
2. **Bedrock Haiku over Sonnet** — 90% cheaper; adequate for all AI modes
3. **Lambda ARM64** — 20% cheaper at same performance
4. **S3 Intelligent-Tiering** — Auto-moves cold invoice files to cheaper storage
5. **DynamoDB On-Demand → Provisioned** — Switch at predictable load (saves ~40%)
6. **Cache aggressively in Redis** — Templates + user profiles cut DynamoDB reads significantly

---

## 5. Migration Plan (localStorage → AWS)

| Phase | Work | Timeline |
|---|---|---|
| **1. Auth** | Integrate Cognito, replace `offline_user`, add JWT refresh | Week 1–2 |
| **2. Data Sync** | Lambda CRUD endpoints, offline sync queue, migrate localStorage on first login | Week 3–5 |
| **3. File Migration** | Move invoice content + logos/signatures from base64 to S3 | Week 6–7 |
| **4. AI Upgrade** | Bedrock provider in `ai-provider.ts`, Lambda AI handler, OpenSearch indexing | Week 8–10 |
| **5. Search & Analytics** | Natural language search, DynamoDB Streams → OpenSearch, analytics dashboard | Week 11–12 |

---

## 6. Repository Layer Mapping

The current TypeScript repository interface stays **identical** — only the implementation changes:

```typescript
// CURRENT (localStorage)
customerRepository.getAll()

// AWS TARGET
// GET /customers → Lambda → DynamoDB.query(PK=USER#{userId}, SK begins_with CUST#)
//   + Redis cache (TTL: 30s)

// CURRENT (localStorage)
invoiceRepository.createInvoice(invoice)

// AWS TARGET
// POST /invoices → Lambda →
//   1. DynamoDB.put(invoice metadata)
//   2. S3.put(invoice content JSON)
//   3. Bedrock.embedText(summary) → OpenSearch index
//   4. Invalidate Redis cache
```

---

## 7. Security Design

- All S3 objects encrypted at rest (SSE-KMS)
- DynamoDB encrypted at rest (AES-256 default)
- All API over TLS 1.2+
- Secrets in AWS Secrets Manager (never in Lambda env vars)
- IAM roles per Lambda (least privilege)
- S3 bucket: block all public access; serve via presigned URLs or CloudFront OAC
- Cognito + API Gateway authorizer on every endpoint
- Per-user S3 path isolation: `invoices/{userId}/...`
- WAF: SQL injection, XSS, geo-blocking rules
- AI rate limit: 10 req/min per user (Redis)

---

## 8. Infrastructure as Code (AWS CDK)

```
infrastructure/
├── bin/app.ts
└── lib/
    ├── auth-stack.ts        ← Cognito User Pool + Identity Pool
    ├── database-stack.ts    ← DynamoDB table + GSIs + Streams
    ├── storage-stack.ts     ← S3 buckets + lifecycle rules
    ├── api-stack.ts         ← API Gateway + Lambda functions
    ├── search-stack.ts      ← OpenSearch domain
    ├── cache-stack.ts       ← ElastiCache Redis
    ├── ai-stack.ts          ← Bedrock permissions + SageMaker
    └── cdn-stack.ts         ← CloudFront + WAF
```

---

## 9. Recommended Starting Point (Lean MVP)

| Component | AWS Service | Rationale |
|---|---|---|
| Auth | Cognito User Pools | Free up to 50K MAU |
| Database | DynamoDB On-Demand | No provisioning needed |
| Files | S3 + CloudFront | Cheapest durable storage |
| Search | DynamoDB GSIs (skip OpenSearch) | Saves $175/mo at MVP scale |
| AI Inference | Bedrock Claude 3 Haiku | Cheap, fast, no GPU mgmt |
| AI Embeddings | Bedrock Titan Embed v2 | Native AWS, no extra infra |
| Cache | ElastiCache Redis t3.micro | Sessions + rate limits |
| API | API Gateway + Lambda | Fully serverless, scales to zero |
| CDN | CloudFront | Edge caching for templates |

**Estimated MVP Cost: $20–$50/month**  
**Estimated Growth Cost: ~$500/month at 500 MAU**  
**Estimated Enterprise Cost: ~$1,500/month at 5K MAU**

---

*EdgeBilling AWS Architecture · Generated April 2026*
