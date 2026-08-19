#!/usr/bin/env node
// Usage: node create.js <contentType-apiId-or-id> <path-to-data.json> [status]
//
// data.json is the entry's `data` object. For a page section entry it must include
// page (slug string) and sectionOrder (number) alongside the content type's own fields:
// { "page": "pricing", "sectionOrder": 3, "title": "...", "items": [...] }
//
// Any `blocks`-typed field value in data.json must be tagged with `_type` (not
// `__component`), e.g. { "_type": "button", "label": "Start Free", "href": "/signup" }.
//
// status defaults to "published"; pass "draft" as the third arg to create a draft.
const { adminRequest, findContentType, readJsonArg } = require('../lib');

(async () => {
	const [key, file, status = 'published'] = process.argv.slice(2);
	if (!key || !file) throw new Error('Usage: node create.js <contentType-apiId-or-id> <path-to-data.json> [status]');
	const ct = await findContentType(key);
	const data = readJsonArg(file);
	const created = await adminRequest(`/api/content-types/${ct.id}/entries`, {
		method: 'POST',
		body: { status, data },
	});
	console.log('Created entry:', JSON.stringify(created, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
