# SubFinder

A recreated local web app based on the Gmail/Eel prototype in `SubFinder.zip`. The archive is reference material; no embedded credentials, database, executable, or document instructions were copied into this app.

## Run

Install Node.js 22 or newer, then run in this folder:

```powershell
npm start
```

Open http://localhost:3210. No npm dependencies are required. Explore demo loads clearly labeled sample receipts. Import receipts works without provider configuration. Run `npm test` to check detection behavior.

You can also double-click **Start SubFinder.cmd** to start the local app and open the browser. In the interface, choose **Connect an inbox**, then Google or Microsoft. If credentials aren't configured, an on-screen setup form shows registration steps and the exact redirect URI. Enter the application's client ID and secret there, then choose **Save and sign in**. No file editing is required. Credentials entered through this form are private to that browser session and disappear on disconnect, expiry, or server restart. After successful login, the scan dialog opens automatically.

## Connect Gmail

1. Create your own Google Cloud project, enable the Gmail API, and configure OAuth branding / consent.
2. Add your Google account as a test user while the app is in testing.
3. Create a **Web application** OAuth client with the exact redirect URI `http://localhost:3210/auth/google/callback`.
4. Copy `.env.example` to `.env` and fill `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Restart the server.
5. Use Continue with Google. Requested permissions are `openid`, `email`, and Gmail read-only.

Gmail read-only is a restricted scope. Public distribution can require Google verification and a security assessment depending on the architecture and applicable exceptions. See https://developers.google.com/workspace/gmail/api/auth/scopes and https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification.

## Connect Outlook / Microsoft 365

1. Register an application in Microsoft Entra. Select organizational and personal Microsoft accounts if both are needed.
2. Add a **Web** redirect URI `http://localhost:3210/auth/microsoft/callback`.
3. Configure delegated `User.Read` and `Mail.Read` permissions, plus OpenID sign-in. A workplace administrator may need to consent.
4. Create a client secret and add its value and application ID to `.env` as `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_CLIENT_ID`. Restart the server.

See https://learn.microsoft.com/en-us/graph/auth-v2-user and https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow.

## Other email providers

There is no universal OAuth login for every mailbox. This version supports Gmail and Microsoft live connections. Other providers can use plain-text `.eml` receipt imports or JSON exports:

```json
[
  {
    "from": "Example <billing@example.com>",
    "subject": "Your subscription receipt",
    "date": "2026-10-01T10:00:00Z",
    "body": "Monthly subscription\nTotal charged USD 10.00"
  }
]
```

Imports replace results. Limit: 2 MB and 500 receipts. Multipart EML and some encoded mail formats are not supported; normalize those to JSON first.

## Privacy and security

- Local loopback server only; host validation blocks arbitrary hosts. Keep `APP_URL` consistent with the URL used in your browser.
- OAuth authorization code flow with PKCE, single-use state, expiry, and session rotation. Provider tokens remain in server memory; no tokens or receipts are stored in browser storage or on disk.
- HttpOnly, SameSite cookies; origin and CSRF checks for mutations; restrictive content security policy; email text displayed without HTML execution.
- Sessions expire after at most one hour or the provider token lifetime. Reconnect after expiry. No refresh tokens are requested or retained.
- Disconnect and server restart clear session data. Closing a browser does not immediately clear the server session. Exported CSVs remain on disk.
- No AI API or third-party analytics. Email credentials from the old ZIP are not used. The ZIP contains credential-related files; review and rotate any credentials you previously shared.

This is a local MVP, not a hosted production service. Live OAuth needs app registration and has not been end-to-end verified without those credentials. Before public hosting, add persistent encrypted storage if desired, production HTTPS and deployment configuration, consent/privacy policies, provider verification, abuse limits, and an independent security review.

## Detection limits

Gmail scans at most 500 messages matching receipt / billing keywords in a chosen date range; Outlook checks at most 500 recent messages in that range. A visible notice reports truncation. Scans replace previous results; provider failures leave prior results intact.

Subscriptions are candidates, not confirmed charges. Rules use recurring language plus a price, prefer charged totals over tax/subtotal, and avoid defaulting unknown billing to monthly. Cancellation and failed-payment messages are excluded. Receipts are grouped by sender, price, currency and cycle, keeping the newest evidence; price changes or multiple plans can produce separate rows. One-off receipts with recurring marketing language can be false positives. Annual costs are divided by 12; unknown cycles are excluded from estimates. No currency conversion is performed.

Marking “To cancel” records your decision only; cancel with the provider. Old receipts do not prove a subscription remains active. Trial expiry, next renewal dates, unused accounts, and every paid subscription cannot reliably be inferred from email alone.
