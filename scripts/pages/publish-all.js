#!/usr/bin/env node
// Usage:
//   node publish-all.js            -> publish every draft page + all their draft sections
//   node publish-all.js --dry      -> report what WOULD change, write nothing
//   node publish-all.js <slug>     -> just one slug (e.g. products/widget)
//   node publish-all.js <slug> --dry
//
// Bulk sibling of pages/publish.js. Publishing a page also publishes all of its
// draft sections (a page can be published while its section entries are still
// drafts, which renders empty on the public site).
const { adminRequest } = require('../lib');

(async () => {
	const args = process.argv.slice(2);
	const DRY_RUN = args.includes('--dry');
	const ONLY_SLUG = args.find((a) => !a.startsWith('--')) || null;

	const pages = await adminRequest('/api/pages');
	const targets = ONLY_SLUG
		? pages.filter((p) => p.slug === ONLY_SLUG || p.slug === `/${ONLY_SLUG}`)
		: pages;

	if (ONLY_SLUG && targets.length === 0) {
		console.log(`slug "${ONLY_SLUG}" not found.`);
		return;
	}
	console.log(`${DRY_RUN ? '[dry run] ' : ''}scanning ${targets.length} page(s)...\n`);

	let pagesPublished = 0;
	let sectionsPublished = 0;
	let failed = 0;
	const failures = [];

	for (const page of targets) {
		const { sections = [] } = await adminRequest(`/api/pages/${page.id}/sections`);
		const draftSections = sections.filter((s) => s.status !== 'published');
		const pageIsDraft = page.status !== 'published';

		if (!pageIsDraft && draftSections.length === 0) continue; // already fully live

		console.log(`${page.slug}  [page: ${page.status}, sections: ${draftSections.length}/${sections.length} draft]`);

		if (DRY_RUN) {
			if (pageIsDraft) console.log('  would publish page');
			draftSections.forEach((s) => console.log(`  would publish section ${s.id} (${s.contentTypeApiId})`));
			continue;
		}

		if (pageIsDraft) {
			try {
				await adminRequest(`/api/pages/${page.id}`, { method: 'PUT', body: { ...page, status: 'published' } });
				pagesPublished++;
				console.log('  page -> published');
			} catch (err) {
				failed++;
				console.log(`  PAGE FAILED: ${err.message}`);
			}
		}
		for (const s of draftSections) {
			try {
				await adminRequest(`/api/entries/${s.id}`, { method: 'PUT', body: { ...s, status: 'published' } });
				sectionsPublished++;
				console.log(`  section ${s.id} -> published`);
			} catch (err) {
				failed++;
				failures.push(`${page.slug} :: ${s.id} (${s.contentTypeApiId}) -> ${err.message}`);
				console.log(`  section ${s.id} FAILED: ${err.message}`);
			}
		}
	}

	console.log(
		`\ndone${DRY_RUN ? ' (dry run, nothing changed)' : ''}: ` +
			`${pagesPublished} page(s), ${sectionsPublished} section(s) published, ${failed} error(s)`,
	);
	if (failures.length) {
		console.log(`\n${failures.length} section(s) failed validation (data needs fixing):`);
		failures.forEach((f) => console.log(`  - ${f}`));
		process.exitCode = 1;
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
