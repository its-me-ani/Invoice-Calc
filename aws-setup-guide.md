# AWS Setup Guide — EdgeBilling Minimum Budget

**Time to complete**: ~15 minutes  
**Cost**: $0/month on AWS free tier  
**Region used in examples**: `ap-south-1` (Mumbai) — change to your preferred region

---

## Prerequisites

```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Configure your credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (ap-south-1), Output format (json)
```

---

## Step 1 — Create Cognito User Pool

```bash
# Create the User Pool
aws cognito-idp create-user-pool \
  --pool-name edgebilling-users \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=false,RequireLowercase=false,RequireNumbers=false,RequireSymbols=false}" \
  --auto-verified-attributes email \
  --username-attributes email \
  --region ap-south-1

# Note the UserPoolId from output: "Id": "ap-south-1_XXXXXXXXX"
```

```bash
# Create App Client (no secret — required for browser/mobile apps)
aws cognito-idp create-user-pool-client \
  --user-pool-id ap-south-1_XXXXXXXXX \
  --client-name edgebilling-app \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --region ap-south-1

# Note the ClientId from output: "ClientId": "XXXXXXXXXXXXXXXXXXXXXXXXXX"
```

---

## Step 2 — Create Cognito Identity Pool

```bash
# Create the Identity Pool
aws cognito-identity create-identity-pool \
  --identity-pool-name edgebilling_identities \
  --allow-unauthenticated-identities \
  --cognito-identity-providers \
    ProviderName=cognito-idp.ap-south-1.amazonaws.com/ap-south-1_XXXXXXXXX,ClientId=XXXXXXXXXXXXXXXXXXXXXXXXXX,ServerSideTokenCheck=false \
  --region ap-south-1

# Note the IdentityPoolId: "ap-south-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
```

---

## Step 3 — Create IAM Roles for Identity Pool

### 3a. Authenticated Role Policy

Save this as `/tmp/auth-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:DeleteItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-south-1:YOUR_ACCOUNT_ID:table/edgebilling-dev",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["${cognito-identity.amazonaws.com:sub}"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::edgebilling-files-dev/${cognito-identity.amazonaws.com:sub}/*"
    }
  ]
}
```

> **Replace `YOUR_ACCOUNT_ID`** with your 12-digit AWS account number.
> Find it: `aws sts get-caller-identity --query Account --output text`

### 3b. Unauthenticated Role Policy

Save this as `/tmp/unauth-policy.json` (very restricted — no access):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Deny", "Action": "*", "Resource": "*" }
  ]
}
```

### 3c. Trust Policy (same for both roles)

Save as `/tmp/trust-policy.json` (replace YOUR_IDENTITY_POOL_ID):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "cognito-identity.amazonaws.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "cognito-identity.amazonaws.com:aud": "YOUR_IDENTITY_POOL_ID"
      },
      "ForAnyValue:StringLike": {
        "cognito-identity.amazonaws.com:amr": "authenticated"
      }
    }
  }]
}
```

```bash
# Create authenticated role
aws iam create-role \
  --role-name EdgeBillingCognitoAuthRole \
  --assume-role-policy-document file:///tmp/trust-policy.json

aws iam put-role-policy \
  --role-name EdgeBillingCognitoAuthRole \
  --policy-name EdgeBillingAuthPolicy \
  --policy-document file:///tmp/auth-policy.json

# Create unauthenticated role
aws iam create-role \
  --role-name EdgeBillingCognitoUnauthRole \
  --assume-role-policy-document file:///tmp/trust-policy.json

aws iam put-role-policy \
  --role-name EdgeBillingCognitoUnauthRole \
  --policy-name EdgeBillingUnauthPolicy \
  --policy-document file:///tmp/unauth-policy.json

# Get role ARNs
aws iam get-role --role-name EdgeBillingCognitoAuthRole --query 'Role.Arn' --output text
aws iam get-role --role-name EdgeBillingCognitoUnauthRole --query 'Role.Arn' --output text
```

```bash
# Attach roles to Identity Pool
aws cognito-identity set-identity-pool-roles \
  --identity-pool-id "ap-south-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" \
  --roles \
    authenticated=arn:aws:iam::YOUR_ACCOUNT_ID:role/EdgeBillingCognitoAuthRole,\
    unauthenticated=arn:aws:iam::YOUR_ACCOUNT_ID:role/EdgeBillingCognitoUnauthRole \
  --region ap-south-1
```

---

## Step 4 — Create DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name edgebilling-dev \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=entityId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=entityId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# Wait for table to be active
aws dynamodb wait table-exists --table-name edgebilling-dev --region ap-south-1
echo "DynamoDB table ready!"
```

---

## Step 5 — Create S3 Bucket

```bash
# Create bucket (bucket names must be globally unique — add your suffix)
aws s3api create-bucket \
  --bucket edgebilling-files-dev \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# Block all public access
aws s3api put-public-access-block \
  --bucket edgebilling-files-dev \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable versioning on invoices prefix (optional but recommended)
aws s3api put-bucket-versioning \
  --bucket edgebilling-files-dev \
  --versioning-configuration Status=Enabled
```

### S3 CORS Configuration

Save as `/tmp/cors.json`:
```json
{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}
```

```bash
aws s3api put-bucket-cors \
  --bucket edgebilling-files-dev \
  --cors-configuration file:///tmp/cors.json
```

---

## Step 6 — Update .env

Fill in your actual values in `.env`:

```env
VITE_AWS_REGION=ap-south-1
VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_COGNITO_IDENTITY_POOL_ID=ap-south-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
VITE_DYNAMO_TABLE=edgebilling-dev
VITE_S3_BUCKET=edgebilling-files-dev
```

Then restart the dev server:
```bash
npm run dev
```

---

## Verification

```bash
# Check User Pool exists
aws cognito-idp describe-user-pool --user-pool-id ap-south-1_XXXXXXXXX --region ap-south-1

# Check DynamoDB table
aws dynamodb describe-table --table-name edgebilling-dev --region ap-south-1

# Check S3 bucket
aws s3 ls s3://edgebilling-files-dev/
```

Open the app → Auth screen appears → Sign Up → check email → enter OTP → you're in.  
Create + save an invoice → check AWS Console for the DynamoDB item and S3 JSON file.

---

## Free Tier Limits (you won't exceed these for a long time)

| Service | Free Limit | Notes |
|---|---|---|
| Cognito | 50,000 MAU | Forever free |
| DynamoDB | 25 GB storage + 200M requests/month | Forever free |
| S3 | 5 GB storage + 20K GET + 2K PUT requests/month | First 12 months |
| Data Transfer | 100 GB/month | First 12 months |
