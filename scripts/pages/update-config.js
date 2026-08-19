#!/usr/bin/env node
// Usage: node update-config.js <path-to-patch.json>
//
// Adds/changes fields on the Page's own schema (PUT /api/pages/config), e.g.
// to add a custom "category" select field that every page can then set in its
// `data`. Same full-replace footgun as content-types/update.js: fetches the
// current config, shallow-merges your patch's top-level keys over it, PUTs the
// merged result. If you're only adding one field, pass the FULL fields array
// here (it's a top-level key, not deep-merged) — or use get-config.js first to
// grab the current array and append to it yourself.
const { adminRequest, readJsonArg } = require('../lib');

(async () => {
	const file = process.argv[2];
	if (!file) throw new Error('Usage: node update-config.js <path-to-patch.json>');
	const current = await adminRequest('/api/pages/config');
	const patch = readJsonArg(file);
	const merged = { ...current, ...patch };
	const updated = await adminRequest('/api/pages/config', { method: 'PUT', body: merged });
	console.log('Updated page config:', JSON.stringify(updated, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
