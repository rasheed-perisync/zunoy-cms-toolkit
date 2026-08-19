#!/usr/bin/env node
// Usage: node get-config.js
//
// GET /api/pages/config — the built-in Page's own field schema (beyond the
// baked-in Name/Slug). If your CMS instance supports "Page Fields" (custom
// fields added onto the Page type itself, e.g. category/isProduct/seo), this
// is how you read that schema — it's a separate endpoint from
// /api/content-types/:id, not a regular content type. Check this before
// creating/updating a page's `data` object so you know which keys are valid
// and which are required (an unfilled required field, or an unknown option on
// a select-type field, 422s on create).
const { adminRequest } = require('../lib');

(async () => {
	const config = await adminRequest('/api/pages/config');
	console.log(JSON.stringify(config, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
