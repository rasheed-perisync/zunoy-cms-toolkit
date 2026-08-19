#!/usr/bin/env node
// Usage: node find-by-type.js <contentType-apiId> [limit]
//
// Shortcut over entries/list.js: GET /api/content-entries?contentTypeApiId=X&limit=N
// looks entries up directly by apiId in one call instead of first resolving the
// content type's id via findContentType() + a separate /entries call. Useful for
// quick cross-page scans of every entry of one section type. limit defaults to 100;
// the CMS has been observed accepting values up to at least 500.
//
// Response shape has been observed as either a bare array or `{ docs: [...] }` —
// this script normalizes to an array either way.
const { adminRequest } = require('../lib');

(async () => {
	const [apiId, limitArg] = process.argv.slice(2);
	if (!apiId) throw new Error('Usage: node find-by-type.js <contentType-apiId> [limit]');
	const limit = Number(limitArg) || 100;
	const raw = await adminRequest(`/api/content-entries?contentTypeApiId=${encodeURIComponent(apiId)}&limit=${limit}`);
	const entries = Array.isArray(raw) ? raw : raw?.docs || [];
	console.log(JSON.stringify(entries, null, 2));
	console.error(`\n${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} found for "${apiId}"`);
})().catch((e) => { console.error(e.message); process.exit(1); });
