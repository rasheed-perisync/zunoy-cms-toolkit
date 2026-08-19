#!/usr/bin/env node
// Usage: node delete.js <entry-id>
// Endpoint is flat: /api/entries/:id — NOT nested under /api/content-types/:typeId/entries/:id.
const { adminRequest } = require('../lib');

(async () => {
	const id = process.argv[2];
	if (!id) throw new Error('Usage: node delete.js <entry-id>');
	await adminRequest(`/api/entries/${id}`, { method: 'DELETE' });
	console.log(`Deleted entry ${id}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
