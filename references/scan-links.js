#!/usr/bin/env node
// Reference script. `isLinkLike()` below assumes every clickable thing in
// your schema is either `{ _type: "link"|"button", href, label }` or a bare
// `{ href, label }` object — that's one project's own content-modeling
// convention (every link/button-shaped field uses that exact shape), not
// something the CMS requires or enforces. Adapt `isLinkLike()` to your own
// schema's link/button shape before using this against a different instance.
//
// Usage:
//   node scan-links.js                  # scan all pages, print only flagged links
//   node scan-links.js uptime           # only pages whose slug starts with "uptime"
//   node scan-links.js --all            # print EVERY link/button found, not just flagged ones
//   node scan-links.js uptime --all
//
// Walks every page's section entries for link/button-shaped fields (objects with
// `_type: "link"`/`"button"` or an {href,label} shape) and flags:
//   - MISSING: no href set at all
//   - MISMATCH: href starts with "/" but doesn't resolve to any known page slug
//
// Pairs with apply-link-fixes.js, which consumes a fixes JSON keyed by the same
// `path` this script prints (e.g. "featureList[0].button").
const { adminRequest } = require('../scripts/lib');

function isLinkLike(obj) {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
	if (obj._type === 'link' || obj._type === 'button') return true;
	return 'href' in obj && 'label' in obj;
}

function walk(obj, pathStr, ctx, results) {
	if (Array.isArray(obj)) {
		obj.forEach((v, i) => walk(v, `${pathStr}[${i}]`, ctx, results));
		return;
	}
	if (!obj || typeof obj !== 'object') return;

	if (isLinkLike(obj)) {
		results.push({ ...ctx, path: pathStr, label: obj.label, href: obj.href });
		return; // don't recurse into the link object's own keys
	}
	for (const [k, v] of Object.entries(obj)) {
		walk(v, pathStr ? `${pathStr}.${k}` : k, ctx, results);
	}
}

(async () => {
	const args = process.argv.slice(2);
	const showAll = args.includes('--all');
	const filterPrefix = args.find((a) => !a.startsWith('--')) || '';

	const pages = await adminRequest('/api/pages');
	const knownSlugs = new Set(pages.map((p) => p.slug.replace(/^\/+/, '')));
	const targets = pages.filter((p) => !filterPrefix || p.slug.startsWith(filterPrefix));
	console.log(`Scanning ${targets.length} page(s)${filterPrefix ? ` matching "${filterPrefix}"` : ''}...\n`);

	for (const page of targets) {
		let sections;
		try {
			({ sections = [] } = await adminRequest(`/api/pages/${page.id}/sections`));
		} catch (e) {
			console.log(`  [ERROR] ${page.slug}: ${e.message}`);
			continue;
		}
		const results = [];
		for (const section of sections) {
			walk(section.data || {}, '', { slug: page.slug, sectionType: section.contentTypeApiId, sectionId: section.id }, results);
		}

		const rows = showAll
			? results
			: results.filter((r) => {
					if (!r.href || !String(r.href).trim()) return true; // MISSING
					if (r.href.startsWith('/')) {
						const normalized = r.href.replace(/^\/+/, '');
						if (!knownSlugs.has(normalized)) return true; // MISMATCH
					}
					return false;
				});

		if (rows.length === 0) continue;
		console.log(`=== ${page.slug} ===`);
		for (const r of rows) {
			const kind = showAll
				? ''
				: !r.href || !String(r.href).trim() ? '[MISSING] ' : '[MISMATCH] ';
			console.log(`  ${kind}${r.sectionType} (${r.sectionId}) :: ${r.path} label=${JSON.stringify(r.label)} href=${JSON.stringify(r.href)}`);
		}
		console.log();
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
