#!/usr/bin/env node
// Usage: node update.js <apiId-or-id> <path-to-patch.json>
//
// PUT /api/content-types/:id is a FULL REPLACE, not a patch — passing only the
// fields you want to change wipes everything else (name, description, category,
// showInPageManager) back to blank/default. This script protects against that:
// it fetches the current document, shallow-merges your patch's top-level keys
// over it, and PUTs the merged result. Pass only the keys you actually want to change.
//
// patch.json example (adds one field to an existing type's fields array — you must
// pass the FULL fields array here since it's a top-level key, not deep-merged):
// { "fields": [ /* ...all existing fields..., {new field} */ ] }
//
// If you just need to add or remove a single field, use add-field.js / remove-field.js
// instead — they do this get-current-array-then-splice step for you.
const { adminRequest, findContentType, readJsonArg } = require('../lib');

(async () => {
	const [key, file] = process.argv.slice(2);
	if (!key || !file) throw new Error('Usage: node update.js <apiId-or-id> <path-to-patch.json>');
	const current = await findContentType(key);
	const patch = readJsonArg(file);
	const merged = { ...current, ...patch };
	const updated = await adminRequest(`/api/content-types/${current.id}`, { method: 'PUT', body: merged });
	console.log('Updated:', JSON.stringify(updated, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
