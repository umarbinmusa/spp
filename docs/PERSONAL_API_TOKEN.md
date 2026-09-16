# Personal API Token — Quick Integration Guide

Every Assalam Telecom account already has a personal **API key** (shown on
your Account page). This lets you call our internal API directly from your
own script or app using your own account's normal pricing (customer,
reseller, etc. — whatever your account type already gets on the website).

> **Looking for a dedicated, production-grade integration instead** — with
> its own pricing tier, rate limits, idempotent requests, and a stable
> versioned API? See [`/api-docs`](/api-docs) and ask an admin about
> becoming an API User. This guide covers the simpler personal-token
> option only.

## Authentication

Send your API key as a Bearer token on every request:

```
Authorization: Bearer <your API key>
```

## Base URL

```
https://<your-backend-domain>/api/v1
```

## Endpoints

### Buy airtime
```
POST /buy/airtime
Content-Type: application/json

{ "mobile_number": "08012345678", "amount": 1000, "network": "1" }
```
Network codes: `1` = MTN, `2` = GLO, `3` = AIRTEL, `4` = 9MOBILE.

### Buy data
```
POST /buy/data
Content-Type: application/json

{ "mobile_number": "08012345678", "plan": 102, "network": "1" }
```
`plan` is the numeric plan `id` (not a text plan code). Network codes for
data: `1` = MTN, `2` = GLO, `3` = AIRTEL, `6` = 9MOBILE (note 9MOBILE
differs from the airtime code above).

Look up available plans and their numeric `id` first:
```
POST /prices
Content-Type: application/json

{ "network": "MTN" }
```

### Buy electricity
```
POST /buy/electricity
Content-Type: application/json

{ "meterId": "01", "meterNumber": "04012345678", "meterType": "prepaid", "amount": 2000 }
```

### Validate a meter
```
POST /buy/validatemeter
Content-Type: application/json

{ "meterNumber": "04012345678", "meterId": "01", "meterType": "prepaid" }
```

### Transaction history
```
GET /transaction
```

## Webhook

Set a webhook URL on your Account page and we'll POST a notification to it
whenever one of your transactions completes.

## Limitations of this option

This personal token uses the same internal endpoints and response shapes
as the website itself, which means:
- No idempotency key — a retried request can create a duplicate purchase.
- No standardized error codes.
- No independent rate limit or usage dashboard.
- The token is a long-lived static secret with no regeneration/revocation
  UI yet — treat it like a password and don't share it.

If you're building something you plan to run in production, the
[`/api-docs`](/api-docs) API User system is the better fit.
