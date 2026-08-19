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
| GET | `/v1/_pages/:slug` | Single page by slug — **see the known bug below before using this** |

## Known backend bug: `/v1/_pages/:slug` 404s on multi-segment slugs

Confirmed against a live instance: `/v1/_pages/appshare` (single segment)
works, but `/v1/_pages/uptime/pricing` or `/v1/_pages/appshare/pricing`
(multi-segment) 404 regardless of URL-encoding or branch param. This is a CMS
backend bug, not something fixable from a client. The production workaround
used in `utils/zunoy-cms.js`: **never call this route** — read pages through
the admin surface instead (`GET /api/pages` + `GET /api/pages/:id/sections`),
even for non-preview/public rendering, and filter out non-published
pages/sections client-side yourself before rendering. If your slugs are all
single-segment you may not hit this at all, but it's worth testing before you
depend on `/v1/_pages/:slug` for anything with a `/` in the slug.

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
