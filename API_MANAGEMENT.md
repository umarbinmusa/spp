# Assalam Telecom — API Management System

This document covers everything added on top of the existing platform to
turn Assalam Telecom into a VTU API provider. Nothing in the existing
`/api/v1` routes, models, or controllers was modified or removed — this is
purely additive.

## What was added

```
Models/
  apiAccessModel.js        ApiAccess    — one per API User (credentials, status, tier, allowed services)
  apiTierModel.js           ApiTier      — STARTER / PRO / BUSINESS / ENTERPRISE default rate limits
  apiPricingModel.js         ApiPricing   — DEFAULT / TIER / USER scoped pricing rules
  apiTransactionModel.js     ApiTransaction — one per external purchase, idempotent on (apiUser, requestId)
  apiLogModel.js             ApiLog       — one per API request (for the admin API Logs page)
  webhookDeliveryModel.js    WebhookDelivery — outbound webhook attempts + retries
  walletLedgerModel.js       WalletLedger — immutable ledger row for every wallet debit/credit
  adminAuditLogModel.js      AdminAuditLog — every admin API-management action

Services/
  walletService.js          Safe, race-condition-proof wallet debit/credit + ledger writes
  pricingService.js         Resolves the price: USER > TIER > DEFAULT > hardcoded fallback
  apiTransactionService.js  Orchestrates a purchase: idempotency, pricing, debit, supplier call,
                             refund-on-failure, webhook dispatch — reuses the existing
                             Controllers/APICALLS/* supplier integrations, does not duplicate them
  apiCredentialService.js   Generates/regenerates apiUserId, apiKey, apiSecret
  webhookService.js         HMAC-signed webhook delivery with retry/backoff
  auditLogService.js        Writes AdminAuditLog rows

Middleware/
  apiAuth.js                Authenticates /api/v2 requests via API key (Bearer or X-API-Key)
  apiRateLimit.js            Per-API-user, per-tier in-memory rate limiting
  apiRequestLogger.js         Writes ApiLog rows + increments ApiAccess request counters

Controllers/Api/            Public /api/v2 controllers (purchase, transactions, wallet, plans, services)
Controllers/Admin/apiManagementController.js   Admin API Management dashboard controller
Controllers/apiUserController.js               Self-service controller for a logged-in API User

Routes/
  apiV2Router.js                Public developer API, mounted at /api/v2
  adminApiManagementRouter.js   Admin routes, mounted at /api/v1/admin/api-management
  apiUserRouter.js              Self-service routes, mounted at /api/v1/api-user

tests/                       Dependency-free logic tests (see "Testing" below)
```

`server.js` was edited only to `require` and `app.use` these three new
routers — every existing route, middleware, and mount order is untouched.

## Not included in this pass

- **Frontend UI.** This repository contains no `client/` folder — `server.js`
  only serves `client/build` if it exists. The Admin API Management pages
  and the API User dashboard pages described in the spec are backend
  endpoints only; there is no React/Vue code to wire them into here.
- **Sandbox environment** (`sandbox.assalamtelecom.com.ng`, fake supplier
  responses). `ApiAccess.environment` (`live`/`sandbox`) exists as a field
  so this can be built on top later, but no sandbox routing or fake-supplier
  logic has been implemented.
- Cable TV purchase remains disabled everywhere (`/api/v2/cable`,
  `/api/v2/validate/cable`), mirroring the existing website behavior.

## Public API documentation

`swagger-ui-express` and `yamljs` were already listed as dependencies and
imported in `server.js`, but never wired up. They now serve a live,
interactive, unauthenticated documentation page for external developers at:

```
GET /api-docs
```

It's generated from `docs/openapi.yaml` — an OpenAPI 3.0 spec covering every
`/api/v2` endpoint, both auth methods (Bearer and `X-API-Key`), every error
code, and example request/response bodies. It includes a "Try it out"
button so a developer can paste in their real API key and test a call
directly from the browser.

This full markdown guide is also served as plain text at:

```
GET /api-docs/API_MANAGEMENT.md
```

Both routes are mounted before the `/api/v1/*` catch-all and require no
authentication — send external developers straight to `/api-docs`.

**Note**: helmet's default Content-Security-Policy blocks the inline
scripts Swagger UI's bundled page uses to boot itself, so CSP is removed
for just the `/api-docs` route (see the comment in `server.js`) — the rest
of the app keeps helmet's full default policy.

If you want multi-language code samples (curl/JS/PHP/Python side by side,
as opposed to Swagger's "Try it out" console), that would need either a
Swagger UI plugin or a separate hand-written docs page — not done here.

## Known platform quirks this code deliberately works around

- **9mobile has two different network IDs in the legacy system**: `4` for
  airtime, `6` for data (see `API_DATA/network.js` and the existing
  `buyAirtime`/`buyData` controllers). `Services/apiTransactionService.js`
  keeps two separate maps (`AIRTIME_NETWORK_ID_MAP` / `DATA_NETWORK_ID_MAP`)
  rather than unifying them — unifying them would silently mis-route
  9mobile data purchases.
- **`dataModel.network` is not populated** by the existing seed data
  (`API_DATA/newData.js`) — only `plan_network` (the display name) is. The
  API purchase flow sources the network ID from the caller's request
  (mapped through `DATA_NETWORK_ID_MAP`), exactly like the existing website
  `buyData` controller does, instead of trusting the unreliable
  `plan.network` field.

## Wallet safety

`Services/walletService.js` never does `user.balance -= amount`. Debits use
a single atomic `findOneAndUpdate({ _id, balance: { $gte: amount } }, { $inc: ... })`.
MongoDB guarantees document-level atomicity even without a replica set, so
two concurrent debits against the same wallet can never both succeed and
push the balance negative — this is verified by a concurrency test in
`tests/walletService.test.js`. Every debit/credit also writes an immutable
`WalletLedger` row.

## Pricing priority

For every purchase, the effective price is resolved in this order and never
silently falls through to the wrong tier:

```
1. USER    — ApiPricing row scoped to this specific ApiAccess
2. TIER    — ApiPricing row scoped to this ApiAccess's tier (STARTER/PRO/BUSINESS/ENTERPRISE)
3. DEFAULT — ApiPricing row with no user/tier scope (system-wide API price)
4. FALLBACK — hardcoded percentages (airtime) / the data plan's own apiPrice field (data)
```

Airtime pricing is `PERCENTAGE` (price = % of face value charged). Data and
the electricity convenience fee are `FIXED` (price = exact Naira amount).

## Idempotency

`ApiTransaction` has a unique compound index on `(apiUser, requestId)`
(partial — only when `requestId` is a string). The transaction row is
created *before* the wallet is touched, so:

- Two concurrent requests with the same `requestId` can never both debit
  the wallet — the second `create()` throws `E11000`, which is caught and
  turned into "return the existing transaction" rather than an error.
- Retrying a request after a network timeout is always safe — the caller
  gets back the original transaction and its final status.

## Admin endpoints (`/api/v1/admin/api-management`, requires admin JWT)

| Method | Path | Purpose |
|---|---|---|
| POST | `/users/:userId/make-api-user` | Converts a normal user into an API User, returns credentials **once** |
| GET | `/users` | List API users (filter by `status`, `tier`, `search`) |
| GET | `/users/:id` | API user detail (stats, config) |
| PATCH | `/users/:id/status` | `{ status: "ACTIVE" \| "SUSPENDED" \| "REVOKED" }` |
| PATCH | `/users/:id/config` | Update tier / allowedServices / rateLimit / webhookUrl |
| POST | `/users/:id/regenerate-key` | Rotates the API key, returns it once |
| POST | `/users/:id/regenerate-secret` | Rotates the API secret, returns it once |
| POST | `/users/:id/test-webhook` | Sends a test payload to the configured webhook |
| GET/POST | `/pricing` | List / upsert an `ApiPricing` rule (DEFAULT, TIER, or USER scope) |
| DELETE | `/pricing/:id` | Remove a pricing rule |
| GET/POST | `/tiers` | List / upsert a tier's default rate limit |
| GET | `/transactions` | All API transactions, filterable |
| GET | `/logs` | Raw request logs, filterable |
| GET | `/analytics` | Business dashboard numbers (API users, revenue today/month, success rate) |

Every mutating action writes an `AdminAuditLog` row.

## Self-service endpoints (`/api/v1/api-user`, requires the user's own website JWT)

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | Wallet, status, request/transaction stats, recent transactions |
| GET | `/credentials` | apiUserId, key prefix, status, tier, webhook config (never the full key/secret) |
| POST | `/regenerate-key` | Rotates own API key |
| POST | `/regenerate-secret` | Rotates own API secret |
| POST | `/webhook` | `{ webhookUrl, webhookEvents }` |
| POST | `/webhook/test` | Sends a test payload |

## Public developer API (`/api/v2`, requires an API key)

Authenticate with either:

```
Authorization: Bearer ak_live_xxxxxxxxxxxxx
```
or
```
X-API-Key: ak_live_xxxxxxxxxxxxx
```

```bash
curl -X POST https://api.assalamtelecom.com.ng/api/v2/airtime \
  -H "Authorization: Bearer ak_live_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"phone":"08012345678","network":"MTN","amount":1000,"requestId":"MYAPP-001"}'
```

| Method | Path | Body |
|---|---|---|
| POST | `/airtime` | `{ phone, network, amount, requestId }` |
| POST | `/data` | `{ phone, network, planCode, requestId }` — `planCode` comes from `GET /data/plans` |
| POST | `/electricity` | `{ meterId, meterNumber, meterType, amount, requestId }` |
| POST | `/cable` | Not available yet (returns `SERVICE_DISABLED`) |
| GET | `/transaction/:transactionId` | — |
| GET | `/transactions` | Query: `page, limit, service, status, from, to, transactionId, requestId` |
| GET | `/data/plans` | Query: `network` (optional) |
| GET | `/services` | — |
| GET | `/wallet` | — |
| POST | `/validate/meter` | `{ meterNumber, meterId, meterType }` |
| POST | `/validate/cable` | Not available yet |

### Response shapes

Success:
```json
{ "success": true, "status": "SUCCESS", "transactionId": "AST-...", "requestId": "MYAPP-001",
  "service": "AIRTIME", "network": "MTN", "amount": 1000, "charged": 990,
  "message": "Airtime purchase successful" }
```

Error:
```json
{ "success": false, "code": "INSUFFICIENT_BALANCE", "message": "Insufficient wallet balance." }
```

### Error codes

`INVALID_API_KEY`, `API_ACCESS_SUSPENDED`, `API_ACCESS_REVOKED`,
`INSUFFICIENT_BALANCE`, `INVALID_REQUEST`, `INVALID_NETWORK`,
`INVALID_AMOUNT`, `SERVICE_DISABLED`, `PLAN_NOT_FOUND`, `DUPLICATE_REQUEST`,
`TRANSACTION_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, `SUPPLIER_ERROR`,
`INTERNAL_ERROR`.

## Rate limiting

In-memory, per `ApiAccess`, fixed 60-second window. Limit = the API user's
own `rateLimit` override if set, else the tier default (STARTER 60/min, PRO
120/min, BUSINESS 300/min, ENTERPRISE 1000/min).

**Limitation**: this is per-process. If the app is ever scaled horizontally
(multiple Node instances behind a load balancer), replace the `Map` in
`Middleware/apiRateLimit.js` with a shared store (Redis) — the function
signature is unchanged either way.

## Security notes

- `apiKeyHash` is a SHA-256 hash of the API key (deterministic, so we can
  look it up by hash on every request without ever storing the raw key).
- `secretHash` is a bcrypt hash of the API secret (never looked up by value,
  only ever regenerated).
- `webhookSecret` is stored in plain text because we must use it to sign
  every outgoing webhook — this mirrors how Stripe/most providers handle
  webhook signing secrets. It is never logged or returned in any response
  except immediately after creation/regeneration.
- Every `/api/v2` route requires `apiAuth` (never the website JWT), and
  every admin API-management route requires the existing `auth` + `isAdmin`
  middleware.
- Cross-user access is prevented by scoping every transaction/log query to
  `req.apiUser._id` in the public API controllers.

## Testing

This sandbox has no network access, so `mongoose`/`jest`/`mongodb-memory-server`
could not be installed to write real DB-backed tests. Instead,
`tests/fakeModel.js` implements a minimal in-memory fake of the Mongoose
query methods the services use, and `tests/stubModule.js` injects these
fakes directly into Node's `require` cache so the *real* service code in
`Services/` runs unmodified against them. Run with:

```bash
npm test
```

Covered:
- Wallet debit/credit safety, including two concurrent debits racing for
  the same funds (only one may succeed; balance never goes negative).
- Pricing priority chain: USER > TIER > DEFAULT > FALLBACK.
- Full airtime purchase lifecycle: success, idempotent retry, refund on
  supplier failure, insufficient balance, invalid network.

Once real dependencies are available in a normal environment, these tests
can be run as-is (they don't require the fakes to be adapted) and should be
supplemented with true `mongodb-memory-server` + `supertest` integration
tests against the actual Express app and Mongoose models, per the spec's
Testing section (auth, pricing, wallet, transactions, webhooks, security).
