#!/usr/bin/env node
// Usage: node publish.js <slug> [--dry]
//
// Publishes a page AND every draft section entry tagged with it in one pass.
// Publishing a page on its own does NOT publish its sections -- a page can go
// live while its sections are still drafts, which renders as an empty page on
// the public site. This script exists so "publish the page" always means
// "publish the page and everything on it."
//
// --dry: report what WOULD change, write nothing.
//
// Scoped to a single slug on purpose. For a full-site bulk publish sweep
// (every draft page), use publish-all.js instead.
const { adminRequest } = require('../lib');

(async () => {
	const [slug, flag] = process.argv.slice(2);
	if (!slug) throw new Error('Usage: node publish.js <slug> [--dry]');
	const DRY_RUN = flag === '--dry';

	const pages = await adminRequest('/api/pages');
	const page = pages.find((p) => p.slug === slug || p.slug === `/${slug}`);
	if (!page) throw new Error(`No page found with slug "${slug}"`);

	const { sections } = await adminRequest(`/api/pages/${page.id}/sections`);
	const draftSections = (sections || []).filter((s) => s.status !== 'published');
	const pageIsDraft = page.status !== 'published';

	if (!pageIsDraft && draftSections.length === 0) {
		console.log(`${slug}: already fully published (page + all ${sections.length} section(s)).`);
		return;
	}

	console.log(`${DRY_RUN ? '[dry run] ' : ''}${slug}  [page: ${page.status}, sections: ${draftSections.length}/${(sections || []).length} draft]`);

	if (DRY_RUN) {
		if (pageIsDraft) console.log('  would publish page');
		draftSections.forEach((s) => console.log(`  would publish section ${s.id} (${s.contentTypeApiId})`));
		return;
	}

	if (pageIsDraft) {
		await adminRequest(`/api/pages/${page.id}`, { method: 'PUT', body: { ...page, status: 'published' } });
		console.log('  page -> published');
	}

	const failures = [];
	for (const s of draftSections) {
		try {
			// Full entry (data + status) preserves page linkage and sectionOrder --
			// a partial PUT here would wipe them, same footgun entries/update.js guards against.
			await adminRequest(`/api/entries/${s.id}`, { method: 'PUT', body: { ...s, status: 'published' } });
			console.log(`  section ${s.id} (${s.contentTypeApiId}) -> published`);
		} catch (err) {
			failures.push(`${s.id} (${s.contentTypeApiId}) -> ${err.message}`);
			console.log(`  section ${s.id} FAILED: ${err.message}`);
		}
	}

	if (failures.length) {
		console.log(`\n${failures.length} section(s) failed to publish (data needs fixing):`);
		failures.forEach((f) => console.log(`  - ${f}`));
		process.exitCode = 1;
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
