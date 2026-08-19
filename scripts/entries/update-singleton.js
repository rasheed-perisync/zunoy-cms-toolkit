#!/usr/bin/env node
// Usage: node update-singleton.js <typeApiId> <path-to-patch.json> [--replace]
//
// Resolves the one entry of a singleton-style type (see get-singleton.js's
// header for why "singleton" isn't a real API concept here, just a
// one-entry convention) and safely merge-patches it — same shallow-merge
// safety as entries/update.js, same one-level-deep caveat on nested objects
// (see docs/admin-api.md). Errors out if more than one entry exists rather
// than guessing which one you meant; use entries/update.js directly with a
// specific entry id in that case.
const { adminRequest, findContentType, readJsonArg } = require('../lib');

(async () => {
	const [typeApiId, file, flag] = process.argv.slice(2);
	if (!typeApiId || !file) throw new Error('Usage: node update-singleton.js <typeApiId> <path-to-patch.json> [--replace]');

	const ct = await findContentType(typeApiId);
	const raw = await adminRequest(`/api/content-types/${ct.id}/entries`);
	const entries = Array.isArray(raw) ? raw : raw?.entries || raw?.data || [];
	if (entries.length === 0) throw new Error(`No entries found for "${typeApiId}" — create one first`);
	if (entries.length > 1) {
		throw new Error(`${entries.length} entries found for "${typeApiId}", expected exactly one. Use entries/update.js <entry-id> directly to target one specifically.`);
	}

	const current = entries[0];
	const patch = readJsonArg(file);
	const data = flag === '--replace' ? patch : { ...current.data, ...patch };
	const updated = await adminRequest(`/api/entries/${current.id}`, {
		method: 'PUT',
		body: { status: current.status, data },
	});
	console.log('Updated singleton:', JSON.stringify(updated, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
