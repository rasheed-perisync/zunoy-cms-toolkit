#!/usr/bin/env node
// Usage: node get.js <apiId-or-id>
// Prints the full content-type document (schema), including all fields.
const { findContentType } = require('../lib');

(async () => {
	const key = process.argv[2];
	if (!key) throw new Error('Usage: node get.js <apiId-or-id>');
	const ct = await findContentType(key);
	console.log(JSON.stringify(ct, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
