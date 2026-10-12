# Public API reference

Base surface: `X-Zunoy-Key` header, `${CMS_BASE_URL}` + these paths.
Published entries only, pinned to one content branch (default branch unless
you pass `?branch=`), read-only. This is the surface a production site should
read from — the admin surface needs a real admin key and returns drafts,
which you never want leaking onto a public page.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/:typeApiId` | List published entries of one type. `?filter[fieldName]=value` filters server-side (repeat the param per field). `?branch=` selects a branch |
| GET | `/v1/:typeApiId/:entryId` | Single entry. Has been observed 404ing for some types even when the entry exists — fall back to listing + finding by id client-side if so (see `list-public.js`'s caller pattern in `utils/zunoy-cms.js`) |
| GET | `/v1/_pages/:slug` | Single page by slug, including multi-segment slugs (e.g. `uptime/pricing`) |

## Fixed: `/v1/_pages/:slug` used to 404 on multi-segment slugs

Multi-segment slugs (`/v1/_pages/uptime/pricing`, `/v1/_pages/appshare/pricing`)
used to 404 on this route because of a CMS backend bug. That is now fixed in
the backend, so `/v1/_pages/:slug` works for any slug. Older consumers such as
`utils/zunoy-cms.js` may still route around it by reading pages through the
admin surface (`GET /api/pages` + `GET /api/pages/:id/sections`) and filtering
out unpublished content client-side. That workaround is no longer needed.

## Filtering syntax

```
GET /v1/pricing-table?filter[category]=starter&filter[active]=true
```

Equality filters only (observed) — no operators, ranges, or full-text search
via this param. Use `scripts/entries/list-public.js <typeApiId>
[filter.json]` to build the query from a flat JSON object.

## Response shape

Has been observed as either a bare array or `{ data: [...] }` depending on
endpoint/CMS version — scripts in this toolkit normalize with
`json.data ?? json`. Do the same in any code you write against this surface;
don't assume one shape.

## Caching guidance (if you're server-rendering from this)

Two request modes worth distinguishing in your own caller, mirrored from a
production consumer of this API:

- **Static/default**: cache the response, only invalidate via your own
  publish-webhook handler (the CMS supports a "Website Deployments"-style
  webhook on publish — exact payload shape is undocumented/varies, so a
  webhook receiver should defensively accept several plausible field names
  for the secret and the changed path rather than assuming one).
- **Preview**: never cache — always `cache: 'no-store'` (or your framework's
  equivalent) and read through the admin surface instead so drafts are
  visible. Never let a preview request populate or read a shared cache that
  a real public request would also hit.
