#!/usr/bin/env node
// Usage: node apply-field-patches.js <patches.json>
//
// Generic batch field-level patcher: given a manifest of exact-path fixes,
// resolves each path into the live entry's `data` and overwrites just that
// leaf, then PUTs the whole entry back (full-entry PUT, so nothing else in
// `data` is touched — see docs/admin-api.md's PUT-is-full-replace notes,
// this script sidesteps that risk by always sending the complete fetched
// entry back with only the target leaf changed).
//
// Unlike references/apply-link-fixes.js (which is hardcoded to set `.href`
// on a link/button-shaped object), this sets whatever value you give it at
// whatever path you give it — useful for any bulk "fix these N fields across
// these N entries" cleanup once you've compiled a list of exact fixes (e.g.
// from references/scan-links.js's output, or your own audit).
//
// patches.json shape: a flat array of
//   { "entryId": "...", "path": "featureList[0].title", "value": "New Title" }
// path uses the same dot/bracket notation as references/scan-links.js prints
// (e.g. "featureList[0].button" or "column.items[2].label").
const { adminRequest, readJsonArg } = require('../lib');

function getParentAndKey(obj, p) {
	const tokens = p.match(/[^.[\]]+/g);
	const lastKey = tokens[tokens.length - 1];
	const parent = tokens.slice(0, -1).reduce((acc, t) => (acc == null ? acc : acc[t]), obj);
	return { parent, lastKey };
}

(async () => {
	const file = process.argv[2];
	if (!file) throw new Error('Usage: node apply-field-patches.js <patches.json>');
	const patches = readJsonArg(file);

	const byEntry = new Map();
	for (const patch of patches) {
		if (!byEntry.has(patch.entryId)) byEntry.set(patch.entryId, []);
		byEntry.get(patch.entryId).push(patch);
	}

	for (const [entryId, entryPatches] of byEntry) {
		let entry;
		try {
			entry = await adminRequest(`/api/entries/${entryId}`);
		} catch (e) {
			console.error(`[${entryId}] fetch failed: ${e.message}`);
			continue;
		}

		for (const patch of entryPatches) {
			const { parent, lastKey } = getParentAndKey(entry.data, patch.path);
			if (!parent || typeof parent !== 'object') {
				console.error(`[${entryId}] path not found: ${patch.path}`);
				continue;
			}
			console.log(`[${entryId}] ${patch.path} :: ${JSON.stringify(parent[lastKey])} -> ${JSON.stringify(patch.value)}`);
			parent[lastKey] = patch.value;
		}

		try {
			await adminRequest(`/api/entries/${entryId}`, { method: 'PUT', body: entry });
			console.log(`[${entryId}] updated`);
		} catch (e) {
			console.error(`[${entryId}] update failed: ${e.message}`);
		}
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
