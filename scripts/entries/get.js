#!/usr/bin/env node
// Usage: node get.js <entry-id>
const { adminRequest } = require('../lib');

(async () => {
	const id = process.argv[2];
	if (!id) throw new Error('Usage: node get.js <entry-id>');
	const entry = await adminRequest(`/api/entries/${id}`);
	console.log(JSON.stringify(entry, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
