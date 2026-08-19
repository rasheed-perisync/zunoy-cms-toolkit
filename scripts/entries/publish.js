#!/usr/bin/env node
// Usage: node publish.js <contentType-apiId-or-id> <entry-id>
//
// Dedicated publish action: POST /api/content-types/:typeId/entries/:entryId/publish,
// no body needed. This is an alternative to entries/update.js with a status patch —
// use whichever your CMS instance's workflow expects; both were observed working
// against the admin API. Requires the owning content type's id/apiId because the
// endpoint is nested under /api/content-types/:typeId/, not flat like GET/PUT/DELETE
// on /api/entries/:id.
const { adminRequest, findContentType } = require('../lib');

(async () => {
	const [ctKey, entryId] = process.argv.slice(2);
	if (!ctKey || !entryId) throw new Error('Usage: node publish.js <contentType-apiId-or-id> <entry-id>');
	const ct = await findContentType(ctKey);
	await adminRequest(`/api/content-types/${ct.id}/entries/${entryId}/publish`, { method: 'POST' });
	console.log(`Published entry ${entryId} (${ct.apiId})`);
})().catch((e) => { console.error(e.message); process.exit(1); });
