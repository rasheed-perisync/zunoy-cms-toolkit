#!/usr/bin/env node
// Reference script — companion to scan-links.js, same content-modeling
// assumption (see that file's header): link/button fields shaped as
// `{ href, label }`, optionally `_type` tagged. Adapt to your own schema.
//
// Usage: node apply-link-fixes.js <link-fixes.json>
//
// Applies a list of href fixes to CMS entries, keyed by the same `path` format
// scan-links.js prints (e.g. "featureList[0].button" or "button[0].data").
//
// link-fixes.json shape: [{ "entryId": "...", "path": "featureList[0].button", "href": "/new-target" }, ...]
const { adminRequest, readJsonArg } = require('../scripts/lib');

function getByPath(obj, p) {
	const tokens = p.match(/[^.[\]]+/g);
	return tokens.reduce((acc, t) => (acc == null ? acc : acc[t]), obj);
}

(async () => {
	const file = process.argv[2];
	if (!file) throw new Error('Usage: node apply-link-fixes.js <link-fixes.json>');
	const fixes = readJsonArg(file);

	const byEntry = new Map();
	for (const fix of fixes) {
		if (!byEntry.has(fix.entryId)) byEntry.set(fix.entryId, []);
		byEntry.get(fix.entryId).push(fix);
	}

	for (const [entryId, entryFixes] of byEntry) {
		let entry;
		try {
			entry = await adminRequest(`/api/entries/${entryId}`);
		} catch (e) {
			console.error(`[${entryId}] fetch failed: ${e.message}`);
			continue;
		}

		for (const fix of entryFixes) {
			const target = getByPath(entry.data, fix.path);
			if (!target || typeof target !== 'object') {
				console.error(`[${entryId}] path not found: ${fix.path}`);
				continue;
			}
			console.log(`[${entryId}] ${fix.path} :: "${target.href}" -> "${fix.href}"`);
			target.href = fix.href;
		}

		try {
			await adminRequest(`/api/entries/${entryId}`, { method: 'PUT', body: entry });
			console.log(`[${entryId}] updated`);
		} catch (e) {
			console.error(`[${entryId}] update failed: ${e.message}`);
		}
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
