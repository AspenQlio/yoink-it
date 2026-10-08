# YOINK-IT // Serverless X Proxy

> A secure, self-hosted Cloudflare Worker proxy to bypass authentication walls on restricted X (Twitter) media without exposing the client IP address.

This proxy intercepts URLs sent from YoinkIt and securely delegates the extraction process to public APIs. This circumvents the `yt-dlp` tombstone errors on age-restricted or private media without requiring local cookie injection or user authentication.

## Architecture

- **Platform:** Cloudflare Workers (Serverless)
- **Security:** Header-based authorization (`x-api-key`)
- **Integration:** React Native `.env` configuration

## Deployment Guide

### 1. Cloudflare Initialization
1. Navigate to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Access **Workers & Pages** -> **Create Application** -> **Create Worker**.
3. Name the worker (e.g., `yoink-x-proxy`) and deploy.

### 2. Script Injection
1. Click **Edit code** on the deployed worker.
2. Replace the boilerplate with the contents of `worker.js` provided in this directory.
3. Click **Deploy**.

### 3. Security Configuration
1. Return to the Worker details page and select **Settings** -> **Variables and Secrets**.
2. Add a new secret variable:
   * **Name:** `EXPECTED_API_KEY`
   * **Value:** *(Define a secure passphrase)*
3. Save and encrypt the variable.

## Application Integration

To connect the Android application to your new proxy instance, configure the local environment variables.

1. Retrieve the public URL of your Cloudflare Worker (e.g., `https://yoink-x-proxy.username.workers.dev`).
2. Add the following keys to your `.env` file in the project root:

```env
EXPO_PUBLIC_X_PROXY_URL=https://your-worker-url.workers.dev
EXPO_PUBLIC_X_PROXY_KEY=your_secure_passphrase
```

Once configured, YoinkIt will automatically detect the presence of the proxy keys and route all X/Twitter extractions through the serverless endpoint. If the keys are omitted, the application will perform a safe fallback to the native `yt-dlp` engine.
