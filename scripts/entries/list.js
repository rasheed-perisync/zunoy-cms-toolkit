#!/usr/bin/env node
// Usage: node list.js <contentType-apiId-or-id>
// Admin listing — returns every status AND every branch mixed together, unfiltered.
// Filter client-side yourself if you need a specific branch/status subset.
const { adminRequest, findContentType } = require('../lib');

(async () => {
	const key = process.argv[2];
	if (!key) throw new Error('Usage: node list.js <contentType-apiId-or-id>');
	const ct = await findContentType(key);
	const entries = await adminRequest(`/api/content-types/${ct.id}/entries`);
	console.log(JSON.stringify(entries, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
