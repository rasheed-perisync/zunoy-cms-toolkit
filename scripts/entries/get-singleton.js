#!/usr/bin/env node
// Usage: node get-singleton.js <typeApiId> [--admin]
//
// Convenience wrapper for "singleton-style" content types (e.g. header,
// footer, global, or any type you've marked `isSingleton: true`) — types
// meant to have exactly one entry. There's no dedicated singleton API
// surface; `isSingleton` only appears to affect the CMS admin UI (single
// edit form instead of a list) — the API itself is the same
// entries-of-a-type surface as any other type, and nothing stops you from
// creating a second entry by mistake. This script fetches and returns the
// FIRST entry of the type, which is the convention singleton types rely on.
//
// Default: public surface (/v1/:typeApiId), published only. --admin: admin
// surface, sees drafts too (useful if the singleton entry itself is still a
// draft and you want to check/edit it before publishing).
const { publicRequest, adminRequest, findContentType } = require('../lib');

(async () => {
	const [typeApiId, flag] = process.argv.slice(2);
	if (!typeApiId) throw new Error('Usage: node get-singleton.js <typeApiId> [--admin]');

	if (flag !== '--admin') {
		const json = await publicRequest(`/v1/${typeApiId}`);
		const entries = json.data ?? json;
		const first = Array.isArray(entries) ? entries[0] : entries;
		if (!first) throw new Error(`No published entry found for "${typeApiId}"`);
		console.log(JSON.stringify(first, null, 2));
		return;
	}

	const ct = await findContentType(typeApiId);
	const raw = await adminRequest(`/api/content-types/${ct.id}/entries`);
	const entries = Array.isArray(raw) ? raw : raw?.entries || raw?.data || [];
	if (entries.length === 0) throw new Error(`No entries found for "${typeApiId}"`);
	if (entries.length > 1) {
		console.error(`WARNING: ${entries.length} entries found for "${typeApiId}" — expected exactly one for a singleton type. Returning the first.`);
	}
	console.log(JSON.stringify(entries[0], null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
