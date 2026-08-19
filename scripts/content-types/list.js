#!/usr/bin/env node
// Usage: node list.js [search-substring]
// Prints id, apiId, name, categories for every content type, optionally filtered.
const { adminRequest } = require('../lib');

(async () => {
	const filter = process.argv[2];
	const types = await adminRequest('/api/content-types');
	const rows = filter
		? types.filter((t) => `${t.apiId} ${t.name}`.toLowerCase().includes(filter.toLowerCase()))
		: types;
	for (const t of rows) {
		console.log(`${t.id}\t${t.apiId}\t${t.name}\t${(t.categories || []).join(',')}`);
	}
	console.log(`\n${rows.length} of ${types.length} content types`);
})().catch((e) => { console.error(e.message); process.exit(1); });
