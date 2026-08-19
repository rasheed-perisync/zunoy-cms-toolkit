# Admin API reference

Base surface: `X-API-Key` header, `${CMS_BASE_URL}` + these paths. Full CRUD,
sees drafts and every content branch (with caveats noted below). This is the
surface every script under `scripts/` uses except `entries/list-public.js`.

This doc is compiled from actually-observed usage across a real CMS project's
scripts and production site code — not from official CMS docs (there may not
be any beyond what the CMS's own UI/support provides). Where behavior was
inferred from a comment in someone else's script rather than confirmed twice,
that's noted.

## Content types

| Method | Path | Notes |
|---|---|---|
| GET | `/api/content-types` | List every content type (schema, not entries) |
| GET | `/api/content-types/:id` | Full schema for one type, incl. `fields` |
| POST | `/api/content-types` | Create. `apiId` auto-derives from `name` on creation, immutable after |
| PUT | `/api/content-types/:id` | **Full replace**, not a patch — see "PUT is full-replace" below |
| DELETE | `/api/content-types/:id` | Deletes the type and (per this CMS's behavior) its entries |

**Field types observed**: `text`, `richtext`, `number`, `boolean`, `media`,
`select` (has `options: [...]`), `repeater` (has `subFields: [...]`),
`blocks` (dynamic-zone-like; has `allowedTypes: [...]`, optional
`single: true`; entries tag each value with `_type`, not `__component` — see
"blocks vs \_\_component" below), and **`reference`** (has `targetApiId`,
points at another content type's entries by id — resolved recursively by
walking the schema, see `scripts/entries/*` and the reference-resolution note
below; arrays of ids are supported too).

**Embedded/private types**: pass `scope: 'embedded'` and `ownerType: '<parent
type's apiId>'` on creation to make a child type usable only as a nested
single-object value on one parent field (no natural "just a plain object"
field type otherwise) — see `content-types/create-embedded-pair.js`.

## Default content-type document properties

Beyond `name`/`apiId`/`description`/`fields`, every content-type document
carries a few more properties automatically — these are NOT entries in the
`fields` array, they're top-level keys on the content-type document itself:

- **`categories`** (array, plural) — groups types for browsing in the CMS
  admin UI. Reuse an existing group label where one fits.
- **`previewImages`** (array) — one or more image URLs shown as the type's
  thumbnail/gallery in the CMS admin, so editors can recognize what a type
  looks like without having to know it by name alone — a type can carry
  multiple preview images to show, e.g., more than one visual variant. Set
  via `content-types/update.js` or the
  `backup/backup-restore-preview-images.js` pair, which handles the full
  array. Some older read paths across this project's scripts only ever read
  a singular `previewImage` (first image only, or a separate legacy field) —
  if you're reading this from your own instance, check which shape your CMS
  version actually returns rather than assuming one.
- **`__variant`** — a default styling-variant property present on content
  types the same way `previewImage` is (not something you declare in
  `fields`). Exact per-type semantics vary by how the frontend's block
  renderer reads it (e.g. `button`-shaped blocks read `variant || __variant`
  and fall back to a default like `'contained'`) — treat it as a reserved key
  every content type carries, not one you need to define yourself.
- **`isSingleton`** — a boolean hint that the type is meant to have exactly
  one entry (header, footer, global, etc.). Appears to be an admin-UI-only
  hint (single edit form instead of a list) — nothing in the API itself
  prevents creating a second entry of a singleton-flagged type. See
  `entries/get-singleton.js`/`update-singleton.js` for working with these.

**Field `order`**: a confirmed-working field definition included an explicit
`order: 0` (and incrementing) on each field, alongside `name`/`apiId`/`type`.
Not confirmed whether the CMS assigns a default order when omitted or
whether it's required for fields to display in the intended sequence in the
admin UI — set it explicitly to be safe, especially on embedded/child types.

## Entries

| Method | Path | Notes |
|---|---|---|
| GET | `/api/content-types/:typeId/entries` | Every status + every branch, unfiltered, no server-side branch filter (see branches below) |
| GET | `/api/content-entries?contentTypeApiId=X&limit=N` | Flat shortcut — looks up entries by type **apiId** directly, skips resolving the type id first. Response has been observed as either a bare array or `{ docs: [...] }` |
| POST | `/api/content-types/:typeId/entries` | Body: `{ status, data }`. `status` is `"draft"` or `"published"` |
| GET | `/api/entries/:id` | Flat — not nested under `/api/content-types/:typeId/entries/:id` (that 404s). Works for drafts directly |
| PUT | `/api/entries/:id` | **Full replace** of the entry's `data` — see below |
| DELETE | `/api/entries/:id` | Flat, same as GET |
| POST | `/api/content-types/:typeId/entries/:entryId/publish` | Dedicated publish action, no body. Alternative to `PUT` with `status: "published"` — both have been observed working; pick one convention and stick to it |

### `blocks` field values use `_type`, not `__component`

Any value inside a `blocks`-typed field must be tagged
`{ "_type": "button", ... }`. `__component` is a leftover convention from an
older internal CMS iteration (`setup-zunoy-cms.js` in one project used it) —
current entries use `_type`.

### PUT is full-replace, not a patch — the single biggest footgun

`PUT /api/entries/:id` and `PUT /api/content-types/:id` both replace the
**entire** record with whatever you send. Passing only the field(s) you meant
to change silently wipes everything else — including, on an entry, `page` and
`sectionOrder`, which makes the entry vanish from its page with no error.
Every mutating script in this toolkit (`entries/update.js`,
`content-types/update.js`, `pages/update.js`, `pages/update-config.js`)
fetches the current record first and shallow-merges your patch's top-level
keys over it before sending. If you write a new script that PUTs, do the same
— never hand-assemble a partial body.

**That shallow merge is only ONE level deep — it does not protect a nested
object's own contents.** If a top-level key's value is itself an object (a
`blocks`-type field like `faqBlock`, an embedded-type value, a `columnLabels`
group), the merge replaces that key with whatever you sent for it wholesale —
it does not recursively merge into it. Patching `{"faqBlock": {"variant":
"plain-grid"}}` to change one sub-key replaces the *entire* `faqBlock` object,
silently dropping its `items[]`. This caused a real data-loss incident in one
project (a FAQ's 8 items wiped by a variant-only patch). Whenever changing one
sub-field inside a nested object, always send that object's **complete**
current contents (fetch the entry first) — never a partial nested patch, even
though the top-level merge makes a partial *top-level* patch look safe.

### Workflow note: changing a field's shape means migrating existing entries too

Restructuring a field on a content type (e.g. replacing 3 flat fields with
one repeater) via `content-types/update.js` only changes the *schema* —
every existing entry's `data` still has the old shape until you migrate it.
There's no generic script for this in the toolkit because the field remapping
is inherently bespoke per schema change (old-field-name → new-shape is a
one-off mapping only you know). The pattern to follow: update the schema
first, then for each affected entry, `entries/get.js` the current data, build
the new-shape value from the old fields in a throwaway script, and
`entries/update.js` it back — do both halves (schema + data) in the same
sitting so entries are never left mid-migration with a shape that no longer
matches their type's schema.

## Pages

Pages are the CMS's own built-in "page" concept — a first-class resource at
`/api/pages`, not a content type you create yourself. (Some projects used to
model pages as a plain custom content type before this feature existed — see
"Page Fields", below, for how to tell if your instance predates it. If your
instance/plan doesn't have this feature, or you'd rather model pages your own
way, none of the CRUD scripts require it — a `blocks`/`reference` content
type works too.)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/pages` | List. `?slug=X` filters server-side |
| GET | `/api/pages/config` | The Page's own field schema — see "Page Fields" |
| PUT | `/api/pages/config` | Add/change fields on the Page type itself. Full-replace, same footgun as above |
| POST | `/api/pages` | Body: `{ slug, title, status, data }` |
| GET | `/api/pages/:id` | Single page record |
| PUT | `/api/pages/:id` | Full-replace |
| GET | `/api/pages/:id/sections` | `{ page, sections: [...] }` — every section entry tagged with that page, every status |

### Page Fields

Beyond the built-in `title`/`slug`, a page's `data` object can carry
whatever custom fields your instance has registered via
`/api/pages/config` (e.g. `category`, `isProduct`, `seo`). Check
`get-config.js` before creating/updating a page — a required Page Field left
unset, or an unrecognized value on a `select`-type field (e.g. an unregistered
`category` option), 422s. It does **not** 422 on every create — only on a
genuinely missing required field or an invalid option value.

### Publishing a page does NOT publish its sections

A page can be `published` while every section entry tagged with it is still
`draft` — this renders as an empty page on the public site. `pages/publish.js`
and `pages/publish-all.js` both publish the page **and** every draft section
in one pass specifically to avoid this trap. If you write a custom page-publish
flow, replicate that — don't just PUT the page's own status.

## Media

| Method | Path | Notes |
|---|---|---|
| GET | `/api/media/folders` | List folders (`id`, `name`) |
| POST | `/api/media/folders` | Body: `{ name }` |
| POST | `/api/media/upload` | `multipart/form-data`, field name `file`, optional `folderId`. No `Content-Type` header — let `fetch` set the multipart boundary itself |

A plain `folder` string on an entry field does **not** associate an upload
with a folder — you need the folder's real `id` from
`/api/media/folders`/`create-folder.js`, passed as `folderId` on upload.

## Branches

The CMS supports git-like content branches. A `?branch=<name>` query param is
honored on the **public** surface (all of it) and on the admin `/api/pages`
and `/api/pages/:id/sections` endpoints — confirmed **not** honored on admin
`/api/content-types/:typeId/entries` (that endpoint always mixes every branch
together with no server filter; entries carry a `branchId` field, defaulting
to `"main"` when absent — filter client-side with `filterEntriesByBranch()`
from `lib.js`).

## Reference-field resolution

A `reference`-typed field stores a bare entry id (or array of ids) and
`targetApiId` names which content type it points at. Nothing in the admin API
resolves this for you — a production consumer has to walk the schema itself:
for each field of type `reference` on an entry's model, `GET` the target
entry by id and splice it in, recursively (needed for `blocks`/`repeater`
fields too, since those can nest further `reference` fields). See
`utils/zunoy-cms.js`'s `populateReferences()` in the zunoy-website-headless-strapi
codebase for a full reference implementation — it's the production one this
was extracted from and worth reading directly for the exact recursion shape,
including the special-cased "hydrate this reference's own referenced pricing
tiers from a totally separate billing API" step some projects layer on top.

## Not ported here (feature-specific, not general CRUD)

Observed in one project's production code but not wrapped as scripts —
build your own thin wrapper if you need these:

- `GET /v1/_search?q=&limit=` — CMS's "AI Studio" intent search (public surface)
- `POST /v1/_ask` — CMS's "AI Studio" Q&A endpoint (public surface)
- `GET /v1/privacy/config`, `POST /v1/privacy/consent` — cookie-consent config/consent (public surface)
- `GET /api/products` — observed being called directly in one scratch script; almost
  certainly just entries of a user-defined `products` content type (all content
  types are user-created — nothing in this CMS ships a built-in "products" concept),
  but the exact contract (is it really identical to
  `/api/content-types/:id/entries` for whichever type has apiId `products`,
  or does it do something extra?) was never confirmed. Verify against your own
  instance before relying on it; `entries/list.js products` is the safe,
  confirmed equivalent if it turns out to be the same thing.
