#!/usr/bin/env node
// Usage: node unlink-section.js <entry-id> [entry-id ...]
//
// Detaches a section entry from its page WITHOUT deleting it — clears
// data.page to an empty string. Entries carry `page` as a plain string the
// CMS never validates against a real page, so this is a safe no-op from the
// CMS's point of view: the entry just stops showing up on any page's
// /api/pages/:id/sections until you set `page` again (e.g. via
// entries/update.js). Useful for temporarily pulling a section without
// losing its content/history, or for the "keep this old section around but
// off any live page" cleanup pattern.
const { adminRequest } = require('../lib');

(async () => {
	const ids = process.argv.slice(2);
	if (ids.length === 0) throw new Error('Usage: node unlink-section.js <entry-id> [entry-id ...]');

	for (const id of ids) {
		const current = await adminRequest(`/api/entries/${id}`);
		const data = { ...current.data, page: '' };
		await adminRequest(`/api/entries/${id}`, { method: 'PUT', body: { status: current.status, data } });
		console.log(`${id} -> unlinked (page cleared)`);
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
