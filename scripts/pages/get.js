#!/usr/bin/env node
// Usage: node get.js <slug> [--admin]
//
// Default: public read (/v1/_pages/:slug, X-Zunoy-Key) — published-only, default branch.
// 404s for a draft page even if it exists — that's the filtering working as intended.
//
// --admin: reads via the unfiltered admin surface instead (GET /api/pages, then finds
// the page by slug and fetches GET /api/pages/:id/sections) — shows drafts/all branches.
// Use this only for verifying draft content, never for anything simulating the public site.
const { adminRequest, publicRequest } = require('../lib');

(async () => {
	const [slug, flag] = process.argv.slice(2);
	if (!slug) throw new Error('Usage: node get.js <slug> [--admin]');

	if (flag !== '--admin') {
		const page = await publicRequest(`/v1/_pages/${slug}`);
		console.log(JSON.stringify(page, null, 2));
		return;
	}

	const pages = await adminRequest('/api/pages');
	const page = pages.find((p) => p.slug === slug);
	if (!page) throw new Error(`No page found with slug "${slug}"`);
	const sections = await adminRequest(`/api/pages/${page.id}/sections`);
	console.log(JSON.stringify({ page, sections }, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
