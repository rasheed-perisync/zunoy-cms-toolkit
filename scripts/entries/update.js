#!/usr/bin/env node
// Usage: node update.js <entry-id> <path-to-patch.json> [--replace]
//
// PUT /api/entries/:id is a FULL REPLACE of the entry's `data` object — passing only
// the changed field(s) silently wipes everything else, including `page`/`sectionOrder`,
// which makes the entry vanish from its page.
//
// Default behavior here is safe: fetch the entry, shallow-merge your patch's top-level
// keys over the existing data, then PUT the merged result. Pass --replace as the third
// arg only if patch.json is already the intentionally-complete data object.
//
// WARNING: the merge is only ONE level deep. If you're changing one sub-key
// inside a nested object (a `blocks`-field value like `faqBlock`, an embedded
// type, any object-valued field), patch.json's value for that top-level key
// REPLACES the whole object — it does not deep-merge into it. This has caused
// real data loss (a FAQ's items[] wiped by a variant-only patch). Fetch the
// entry first (get.js) and send that nested object's complete current
// contents, never just the sub-key you meant to change. See
// docs/admin-api.md's "PUT is full-replace" section.
const { adminRequest, readJsonArg } = require('../lib');

(async () => {
	const [id, file, flag] = process.argv.slice(2);
	if (!id || !file) throw new Error('Usage: node update.js <entry-id> <path-to-patch.json> [--replace]');
	const patch = readJsonArg(file);
	const current = await adminRequest(`/api/entries/${id}`);
	const data = flag === '--replace' ? patch : { ...current.data, ...patch };
	const updated = await adminRequest(`/api/entries/${id}`, {
		method: 'PUT',
		body: { status: current.status, data },
	});
	console.log('Updated entry:', JSON.stringify(updated, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
