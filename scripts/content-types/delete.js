#!/usr/bin/env node
// Usage: node delete.js <apiId-or-id>
// Destructive — deletes the content type and (per most CMS backends' behavior)
// any entries under it. Confirm with the user before running this.
const { adminRequest, findContentType } = require('../lib');

(async () => {
	const key = process.argv[2];
	if (!key) throw new Error('Usage: node delete.js <apiId-or-id>');
	const ct = await findContentType(key);
	await adminRequest(`/api/content-types/${ct.id}`, { method: 'DELETE' });
	console.log(`Deleted content type ${ct.apiId} (${ct.id})`);
})().catch((e) => { console.error(e.message); process.exit(1); });
