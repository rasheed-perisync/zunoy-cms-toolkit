#!/usr/bin/env node
// Usage: node find-by-slug.js <slug>
//
// Admin-surface lookup by slug in one call: GET /api/pages?slug=X, instead of
// pages/get.js --admin's list-then-find. Still returns drafts/all branches
// (it's the admin surface) — use pages/get.js (public, no flag) if you want
// published-only.
const { adminRequest } = require('../lib');

(async () => {
	const slug = process.argv[2];
	if (!slug) throw new Error('Usage: node find-by-slug.js <slug>');
	const result = await adminRequest(`/api/pages?slug=${encodeURIComponent(slug)}`);
	const pages = Array.isArray(result) ? result : result?.data || [];
	console.log(JSON.stringify(pages, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
