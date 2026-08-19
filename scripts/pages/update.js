#!/usr/bin/env node
// Usage: node update.js <page-id> <path-to-patch.json> [--replace]
//
// PUT /api/pages/:id replaces the page record. Default behavior here is safe: fetch
// the page, shallow-merge the patch's top-level keys (title, slug, status) over the
// existing record, deep-merge patch.data over existing data, then PUT the merged
// result. Pass --replace to skip merging and send patch.json as the full record.
//
// IMPORTANT: changing `slug` here does NOT update the `page` field on any section
// entries already tagged with the old slug -- those entries will silently become
// orphaned (dead sections, invisible on the page) unless you also run entries/update.js
// on each one with the new slug.
const { adminRequest, readJsonArg } = require('../lib');

(async () => {
	const [id, file, flag] = process.argv.slice(2);
	if (!id || !file) throw new Error('Usage: node update.js <page-id> <path-to-patch.json> [--replace]');
	const patch = readJsonArg(file);
	const current = await adminRequest(`/api/pages/${id}`);
	const merged = flag === '--replace'
		? patch
		: { ...current, ...patch, data: { ...current.data, ...(patch.data || {}) } };
	const { id: _id, tenantId, branchId, createdAt, updatedAt, ...body } = merged;
	const updated = await adminRequest(`/api/pages/${id}`, { method: 'PUT', body });
	console.log('Updated page:', JSON.stringify(updated, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
