# Deploying EdgeBilling on Vercel (Web & PWA)

This guide walks you through deploying the EdgeBilling application to Vercel. Since EdgeBilling is built using Vite, React, and Ionic, it is fully compatible with Vercel's out-of-the-box static hosting.

## Prerequisites
- A [Vercel](https://vercel.com/) account.
- Your project code pushed to a Git repository (GitHub, GitLab, or Bitbucket).

---

## Step 1: Import Project to Vercel
1. Log in to your Vercel Dashboard.
2. Click **Add New...** and select **Project**.
3. Import the Git repository containing `EdgeBilling`.

## Step 2: Configure Project Settings
Once the repository is imported, Vercel will automatically detect that it's a **Vite** project. Ensure the following settings are correct:

- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## Step 3: Set Environment Variables
If your application uses AWS Cloud Sync, you must provide your AWS configuration to Vercel so the production build can connect to your DynamoDB and S3 instances.

Expand the **Environment Variables** section and add the following keys exactly as they appear in your `.env` file:

| Name | Example Value |
|------|---------------|
| `VITE_AWS_REGION` | `us-east-1` |
| `VITE_AWS_COGNITO_IDENTITY_POOL_ID` | `us-east-1:xxxx-xxxx-xxxx` |
| `VITE_AWS_S3_BUCKET` | `edgebilling-files-dev` |
| `VITE_AWS_DYNAMODB_TABLE` | `edgebilling-dev` |

> [!WARNING]
> Do NOT include `NODE_ENV=production` as Vercel automatically sets this during the build process. Also, do not upload your Android Keystore secrets (`RELEASE_STORE_PASSWORD`, etc.) to Vercel; those are only for GitHub Actions (Android APK building).

## Step 4: Deploy
1. Click **Deploy**.
2. Vercel will run `npm install`, followed by `npm run build` (which compiles the TypeScript and builds the Vite distribution).
3. Once the build completes successfully, Vercel will provide a live URL (e.g., `edgebilling.vercel.app`).

---

## Step 5: Handling React Router (Optional but Recommended)
Since EdgeBilling uses client-side routing (React Router), refreshing a page on a specific route (e.g., `/app/dashboard`) might result in a 404 error because the server is looking for a literal `/app/dashboard/index.html` file.

Vercel's Vite preset usually handles this automatically, but to guarantee PWA and React Router stability, you can create a `vercel.json` file in the root of your project:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
If you add this file, commit it and push it to your repository. Vercel will automatically trigger a new deployment.

---

## Step 6: PWA Support
As long as your project includes a valid `manifest.json` (or `manifest.webmanifest`) and registers a service worker, Vercel will serve these static assets automatically.
- Users visiting your Vercel URL on mobile (Chrome/Safari) or Desktop Chrome will see an **"Install App"** prompt.
- Ensure your `index.html` correctly links to the manifest file in the `<head>` section.
