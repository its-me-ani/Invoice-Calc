# EdgeBilling Hybrid Storage Architecture

The following Mermaid diagram illustrates the dual-storage strategy (Local First + Cloud Sync) implemented in the application.

> [!NOTE]
> This architecture ensures that the application remains extremely fast and functional offline, while preventing local device storage from bloating by limiting local saves to 10 invoices. All data is eventually persisted to AWS.

```mermaid
sequenceDiagram
    participant UI as React UI (Dashboard/Editor)
    participant LS as Local Storage (SQLite)
    participant SS as Sync Service (Queue)
    participant DDB as AWS DynamoDB (Metadata)
    participant S3 as AWS S3 (Files)

    %% --- Save Flow ---
    rect rgb(240, 248, 255)
    Note over UI,S3: 1. Save Invoice Flow
    UI->>LS: Save Invoice (Metadata + Content)
    activate LS
    LS-->>LS: Check count > 10?
    LS-->>LS: If yes, Evict oldest synced invoice
    LS-->>UI: Saved locally
    deactivate LS
    
    UI->>SS: pushInvoiceToCloud()
    activate SS
    alt Online & Successful
        SS->>DDB: Save Metadata
        SS->>S3: Upload JSON Content
    else Offline or Failed
        SS-->>SS: Add to Offline Sync Queue
    end
    deactivate SS
    end

    %% --- View Local Flow ---
    rect rgb(245, 255, 250)
    Note over UI,S3: 2. View "Local" Tab
    UI->>LS: getSavedInvoices()
    LS-->>UI: Return up to 10 invoices
    UI->>SS: getQueue()
    SS-->>UI: Return pending sync IDs
    UI-->>UI: Show Synced/Offline icons based on Queue
    end

    %% --- View Cloud Flow ---
    rect rgb(255, 250, 240)
    Note over UI,S3: 3. View "Cloud" Tab
    UI->>DDB: getInvoices(userId)
    DDB-->>UI: Return ALL invoice metadata
    UI-->>UI: Display list with Synced icons
    end

    %% --- Open Cloud Invoice ---
    rect rgb(253, 245, 230)
    Note over UI,S3: 4. Open Invoice from Cloud Tab
    UI->>DDB: getInvoice(userId, invoiceId)
    DDB-->>UI: Return Metadata
    UI->>S3: getInvoiceContent(userId, invoiceId)
    S3-->>UI: Return JSON Content
    UI-->>UI: Load into SocialCalc Editor
    end
```

### Key Concepts

1. **Local Eviction Strategy**: When a user saves an invoice, the local SQLite database is capped at 10 items. The system queries the `Offline Sync Queue` to ensure it never deletes an invoice that hasn't safely reached the cloud.
2. **Eventual Consistency**: The `Sync Service` catches any failed network requests to AWS. When the network is restored, `flushSyncQueue()` empties the queue and updates DynamoDB/S3.
3. **Lazy Loading**: The Cloud tab fetches *metadata only* from DynamoDB. The heavy `.json` content is only downloaded from S3 when the user explicitly clicks to open an older cloud invoice.
