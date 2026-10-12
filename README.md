# zunoy-cms-toolkit

General-purpose Node scripts for driving the Zunoy CMS admin API — content
types, entries, pages, media, backups, and content audits. No dependencies,
no CLI framework: every script is a plain `node <file>.js <args>` invocation
you can read top to bottom.

Extracted from years of one-off migration/seed scripts across Zunoy CMS
projects — these are the operations that actually generalize (CRUD, backup,
audit), with the one-off content-seeding scripts left behind.

## Setup

Requires Node 18+ (uses global `fetch`/`FormData`/`Blob`).

```
export CMS_BASE_URL=https://api.example.com/api/v1/cms
export CMS_API_KEY=your-api-key
```

Every script reads these two env vars via `scripts/lib.js` — never hardcode
them in a script or commit them anywhere.

### Two API surfaces

- **admin** — full CRUD, sees drafts and every branch (with caveats — see
  docs). Header: `X-API-Key`. Paths like `/api/content-types`, `/api/entries`,
  `/api/pages`. Almost every script here uses this surface.
- **public** — published content on one branch only, read-only. Header:
  `X-Zunoy-Key`. Paths like `/v1/:typeApiId`. Used by `pages/get.js` by
  default (pass `--admin` to read the admin surface instead) and by
  `entries/list-public.js`.

Full endpoint reference, including things that only show up from reading
real production usage (the now-fixed `/v1/_pages/:slug` multi-segment bug, branch-param
support quirks, the `reference` field type, page fields): [`docs/admin-api.md`](docs/admin-api.md),
[`docs/public-api.md`](docs/public-api.md).

## Scripts

### `scripts/content-types/`
| Script | Usage |
|---|---|
| `create.js` | `<schema.json>` — create a new content type |
| `get.js` | `<apiId-or-id>` — print full schema |
| `update.js` | `<apiId-or-id> <patch.json>` — safe merge-patch (see script header re: full-replace footgun) |
| `delete.js` | `<apiId-or-id>` — destructive, deletes the type and its entries |
| `list.js` | `[filter]` — list all types, optionally filtered |
| `add-field.js` | `<apiId-or-id> <field.json> [--parent=<apiId>]` — append one field, idempotent |
| `remove-field.js` | `<apiId-or-id> <field-apiId> [--parent=<apiId>]` — remove one field |
| `create-embedded-pair.js` | `<pair.json>` — create a private embedded child type + its parent, in the right order |
| `gen-docs.js` | `<output.md> [filter]` — generate a markdown field reference for all/matching types |
| `clear-required.js` | `<apiId> [apiId ...]` — recursively clear `required: true` across a batch of types (incl. nested subFields), e.g. to let incomplete drafts publish |

### `scripts/entries/`
| Script | Usage |
|---|---|
| `create.js` | `<contentType> <data.json> [status]` |
| `get.js` | `<entry-id>` |
| `update.js` | `<entry-id> <patch.json> [--replace]` — safe merge-patch by default |
| `delete.js` | `<entry-id>` |
| `list.js` | `<contentType>` — every status/branch, unfiltered |
| `list-public.js` | `<typeApiId> [filter.json] [branch]` — public surface, published-only, filterable |
| `find-by-type.js` | `<contentType-apiId> [limit]` — shortcut, skips resolving the type id first |
| `publish.js` | `<contentType-apiId-or-id> <entry-id>` — dedicated publish action (alternative to `update.js` + status patch) |
| `apply-field-patches.js` | `<patches.json>` — generic batch field-level patcher by exact path, from a manifest of `{entryId, path, value}` |
| `resolve-references.js` | `<entry-id>` — recursively resolves `reference`-typed field ids into their actual entries |
| `get-singleton.js` | `<typeApiId> [--admin]` — fetch the one entry of a singleton-style type (header/footer/global/etc.) |
| `update-singleton.js` | `<typeApiId> <patch.json> [--replace]` — safe merge-patch the one entry of a singleton-style type |
| `fix-alt-keys.js` | `[--slug=homepage] [--all] [--entry=<id>] [--apply]` — renames `<fieldName>Alt` keys to `<fieldName>_alt` recursively, dry-run by default |

### `scripts/pages/`
| Script | Usage |
|---|---|
| `create.js` | `<slug> <title> [data.json] [status]` |
| `get.js` | `<slug> [--admin]` — public (published) by default |
| `find-by-slug.js` | `<slug>` — admin surface, one call instead of list-then-find |
| `update.js` | `<page-id> <patch.json> [--replace]` |
| `delete.js` | `<page-id>` — destructive, does NOT clean up that page's orphaned section entries |
| `get-config.js` | no args — the Page type's own field schema ("Page Fields") |
| `update-config.js` | `<patch.json>` — add/change fields on the Page type itself, safe merge-patch |
| `publish.js` | `<slug> [--dry]` — publish a page + all its draft sections |
| `publish-all.js` | `[slug] [--dry]` — bulk publish every draft page (or one slug) + sections |
| `reorder-sections.js` | `<ids.json> [--start=0]` — set `sectionOrder` on a list of entries to match the order you list them in |
| `unlink-section.js` | `<entry-id> [entry-id ...]` — detach a section from its page (clears `page`) without deleting the entry |

### `scripts/forms/`
| Script | Usage |
|---|---|
| `list.js` | no args — list CMS Forms API forms |
| `get.js` | `<form-id-or-slug>` — read one form from the authenticated collection |
| `create.js` | `<form.json>` — create a form from `{ "name", "slug", "description"? }` |
| `update.js` | `<form-id-or-slug> <patch.json>` — safely update `name`, `slug`, and/or `description` |
| `delete.js` | `<form-id-or-slug>` — permanently delete a form |

#### `scripts/forms/submissions/`
| Script | Usage |
|---|---|
| `list.js` | `<form-id-or-slug>` — read-only list of submissions for one form |
| `create.js` | `<form-id-or-slug> <submission.json> [branch]` — submit JSON through the public Forms API |

The Forms API defaults to `https://api.zunoy.com/api/v1/cms`; override it with
`CMS_FORMS_BASE_URL` when needed. Form tags are intentionally unsupported here
until their taxonomy API is available.

### `scripts/branches/`
| Script | Usage |
|---|---|
| `get.js` | `[branch-id-or-slug]` — read-only list or lookup of CMS branches |

### `scripts/media/`
| Script | Usage |
|---|---|
| `create-folder.js` | `<name>` |
| `list-folders.js` | `[filter]` |
| `upload.js` | `<file> [folderId]` |
| `upload-and-assign.js` | `<file> <entry\|content-type> <id> <fieldPath> [folderId]` — upload then patch the URL onto a field |

### `scripts/backup/`
| Script | Usage |
|---|---|
| `backup-content-types.js` | dumps every schema to `../backups/<date>/content-types/` |
| `backup-pages.js` | dumps every page + its sections to `../backups/<date>/` |
| `backup-entries.js` | `<contentType>` — dumps every entry of one type |
| `backup-restore-preview-images.js` | `backup\|restore <dir> [apiId]` — content-type previewImage backup/restore pair |

### `scripts/audit/`
| Script | Usage |
|---|---|
| `count-pages-entries.js` | no args — per-page section counts |
| `find-unused-dynamic-zone-components.js` | `[backup.json]` — content types never referenced as a blocks `allowedType` |
| `find-type-usages.js` | `<apiId> [apiId ...] [backup.json]` — reverse lookup: where IS this type referenced, useful before deleting/renaming one |
| `wipe-collection.js` | `<pages\|entries> [contentType] [--yes]` — destructive bulk delete, dry-run without `--yes` |
| `rehost-broken-assets.js` | `--old-host= --fallback-host= [--page=] [--component=] [--limit=] [--apply]` — find asset URLs pointing at a dead host anywhere in entry data, re-upload from a fallback host, rewrite. Dry-run by default |

### `references/`

Not general-purpose CLI tools — read and adapt before running, don't treat as
drop-in commands. Each one exists because of a specific project's own
content-modeling or editorial choices, not a CMS requirement — kept here as
worked examples of real patterns rather than in `scripts/` alongside the
things that generalize to any instance.

| Script | What it's for |
|---|---|
| `create-custom-page-content-type.js` | If your CMS instance has no native Page Fields support, or you'd rather model pages yourself: defines "Page" as a plain content type instead of using `scripts/pages/`. See the file header for the tradeoffs — native `/api/pages` is preferable if it's available. |
| `create-custom-seo-content-type.js` | Companion SEO type for the pattern above, referenced from a custom Page's `reference` field. |
| `generate-icon-asset.js` / `generate-emoji-icon-asset.js` | Bake an Iconify glyph or emoji into a fixed-shape tinted SVG tile, for a project that made the editorial call to require `media`-type icon fields (so non-technical editors never have to type an iconify id). The tile's exact shape (40×40 squircle, specific corner radius) is that project's own visual design. If your instance is fine with a plain icon-name text field, skip this whole pipeline entirely. |
| `check-iconify-icons.js` | Support tool for the pipeline above — verifies iconify ids resolve before you burn a batch of tile-generation calls on typos. Doesn't touch the CMS at all. |
| `scan-links.js` / `apply-link-fixes.js` | Walk every page for link/button-shaped fields and report/fix broken hrefs. Assumes every clickable thing in the schema is shaped `{ _type: "link"\|"button", href, label }` (or bare `{ href, label }`) — one project's own convention for modeling links, not a CMS requirement. Adapt `isLinkLike()` to your own schema's shape before reusing. |

## Safety notes

- `content-types/update.js`, `entries/update.js`, and `pages/update.js` all
  guard against the classic "PUT is a full replace" footgun by fetching the
  current record and merging your patch over it — pass `--replace` only when
  you deliberately want to send the complete object.
- `content-types/delete.js` and `audit/wipe-collection.js` are destructive.
  `wipe-collection.js` defaults to a dry-run; you must pass `--yes` to delete.
- Never commit `CMS_API_KEY` anywhere. Export it in your shell or a
  gitignored `.env.local` you source yourself.
