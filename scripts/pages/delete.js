#!/usr/bin/env node
// Usage: node delete.js <page-id>
// Destructive — deletes the page record itself. Does NOT delete the section
// entries tagged with its slug (they carry a plain "page" string field the
// CMS never validates against a real page) — those become orphaned, not
// auto-removed. Clean those up yourself first if you want a full teardown
// (see entries/list.js / audit/wipe-collection.js).
const { adminRequest } = require('../lib');

(async () => {
	const id = process.argv[2];
	if (!id) throw new Error('Usage: node delete.js <page-id>');
	await adminRequest(`/api/pages/${id}`, { method: 'DELETE' });
	console.log(`Deleted page ${id}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
