#!/usr/bin/env node
// Usage: node create.js <slug> <title> [data.json] [status]
//
// Creates the Page record itself (POST /api/pages). Do this BEFORE creating any
// section entries tagged with that page's slug -- entries just carry a plain
// "page" string field, so the CMS never validates it against a real page, and
// entries can silently sit orphaned pointing at a slug with no Page behind it.
//
// data.json (optional) is the page's `data` object -- meta-title, meta-desc,
// isProduct, category, etc. GET /api/pages/config on your CMS instance returns
// the current field list; isProduct is required by that schema.
//
// status defaults to "draft"; pass "published" as the fourth arg to publish immediately.
const { adminRequest, readJsonArg } = require('../lib');

(async () => {
	const [slug, title, dataFile, status = 'draft'] = process.argv.slice(2);
	if (!slug || !title) throw new Error('Usage: node create.js <slug> <title> [data.json] [status]');
	const data = dataFile ? readJsonArg(dataFile) : { isProduct: false };
	const created = await adminRequest('/api/pages', {
		method: 'POST',
		body: { slug, title, status, data },
	});
	console.log('Created page:', JSON.stringify(created, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
