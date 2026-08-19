#!/usr/bin/env node
// Counts all pages and, for each, how many section entries it has.
// Usage: CMS_BASE_URL=... CMS_API_KEY=... node count-pages-entries.js
const { adminRequest } = require('../lib');

(async () => {
	console.log('Fetching page list from /api/pages ...');
	const pages = await adminRequest('/api/pages');
	console.log(`Found ${pages.length} pages. Fetching section entries for each...\n`);

	let totalEntries = 0;
	let failedPages = 0;
	const rows = [];

	for (const [i, p] of pages.entries()) {
		process.stdout.write(`[${i + 1}/${pages.length}] ${p.slug} ... `);
		let sections = [];
		try {
			const raw = await adminRequest(`/api/pages/${p.id}/sections`);
			sections = Array.isArray(raw)
				? raw
				: raw?.sections || raw?.data || raw?.entries || [];
			if (!Array.isArray(sections)) {
				console.log(`unexpected shape: ${JSON.stringify(raw).slice(0, 200)}`);
				sections = [];
			} else {
				console.log(`${sections.length} entries`);
			}
		} catch (e) {
			failedPages++;
			console.log(`FAILED (${e.message})`);
		}
		totalEntries += sections.length;
		rows.push({ slug: p.slug, title: p.title, status: p.status, sections: sections.length });
	}

	rows.sort((a, b) => b.sections - a.sections);

	console.log('\n--- Per-page breakdown (sorted by entry count) ---');
	for (const r of rows) {
		console.log(`${String(r.sections).padStart(4)} entries  [${r.status}]  ${r.slug}  (${r.title})`);
	}

	console.log('\n--- Summary ---');
	console.log(`Pages:          ${pages.length}`);
	console.log(`Failed lookups: ${failedPages}`);
	console.log(`Total entries:  ${totalEntries}`);
})().catch((e) => { console.error('Fatal error:', e.message); process.exit(1); });
