# Live bring-your-own-registration demo

https://thefamousjc.github.io/subfinder/

Each visitor can supply their own public Google OAuth client ID or Microsoft application client ID. Never enter a client secret, password or access token in the demo. Setup steps and exact origin/redirect values are shown under Connect email. Gmail uses Google Identity Services' browser token model; Microsoft uses SPA authorization code flow with PKCE. Mail requests go directly from the browser to the provider APIs. Tokens and receipts remain in memory. Public client IDs and a temporary Microsoft PKCE verifier use session storage, cleared by Disconnect. Reload requires reconnecting. The hosting origin is shared by this account's other GitHub Pages projects.

Google test-user, restricted-scope and verification rules still apply to the visitor's registration. Microsoft may require an Entra tenant/account with permission to register apps, and workplace users may need admin consent. This is not a verified shared public OAuth service. No real sign-in has been verified without a configured visitor-owned registration; automated tests use mocked providers.

Build the live browser edition with `node build-browser-oauth.mjs`. Deploy index.html and browser-connections.js together. `node build-pages.mjs` still builds the import-only edition. Run `node --test` for detector, original local-server and browser OAuth checks.

Official setup references:
https://developers.google.com/identity/oauth2/web/guides/use-token-model
https://developers.google.com/workspace/gmail/api/auth/scopes
https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow

---

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





The Connect email dialog now provides a one-step-at-a-time wizard for each provider. setup-wizard.js defines the guidance and navigation; setup-wizard.html and setup-wizard.css provide its layout. Progress is visitor-reported, not an automatic verification of provider configuration. The builder embeds the HTML/CSS and loads setup-wizard.js alongside browser-connections.js.


## Step image sources

All 13 wizard steps include a visual with an enlarged viewer. Microsoft screenshots are unmodified public examples from https://learn.microsoft.com/en-us/graph/auth-register-app-v2 with CSS number/target overlays. Their example account selections and IDs must not be copied; captions explain the relevant target. The Google final-step image is a real capture of SubFinder with no credentials. Google console steps 1–7 use original SVG click-guide illustrations, visibly labelled NOT A SCREENSHOT and linked to the official Google setup instructions. These are not captures of a private Google account. The visual metadata and rendering live in setup-visuals.js. Retain attribution and labels when updating them.

## Sanitized Google Console captures — October 27, 2026

Google visuals now use real Console crops. Menu, project-picker, Gmail API and empty branding-form controls were captured read-only with explicit permission. Account headers, project identifiers, email addresses and project lists are outside the crops. Every temporary full-screen original was deleted immediately after cropping; only sanitized assets are publishable. Test-user, scope and OAuth-client forms were unavailable in the unconfigured project. Those three steps use real navigation-only screenshots with captions stating that the later forms appear after earlier setup; no configuration, API enablement or credentials were created to obtain screenshots. The earlier illustration SVGs are retained as unreferenced source fallbacks, not used by the live step visuals.
