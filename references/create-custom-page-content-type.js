#!/usr/bin/env node
// Reference script, not a general CLI tool — read and adapt before running.
//
// Alternative to the native /api/pages surface (see scripts/pages/): defines
// "page" as a plain content type you own and control, the way projects had
// to before their CMS instance had "Page Fields" support (see
// docs/admin-api.md's Page Fields section). Use this if:
//   - your CMS plan/instance doesn't have the native Pages feature, or
//   - you'd rather model pages entirely yourself (custom required fields,
//     a different blocks/slots shape, no reliance on /api/pages/config), or
//   - you're prototyping and don't want to touch the built-in Page type yet.
//
// If your instance DOES have native Pages and you have no strong reason to
// avoid it, prefer scripts/pages/create.js + content-types/add-field.js on
// /api/pages/config instead — you get page-vs-draft workflow, the sections
// endpoint, and publish semantics for free, none of which this pattern gets
// you (you'd have to build your own page/sectionOrder linkage the same way
// scripts/entries/create.js's data.json convention already does).
//
// This creates a "Page" content type with a Blocks field whose allowedTypes
// is every OTHER existing content type (so any section type can be dropped
// into a page). Run this ONCE per CMS instance, before creating any page
// entries. Values placed into the Blocks field must be tagged with `_type`
// (not `__component` — an older convention some legacy scripts used, no
// longer correct, see docs/admin-api.md).
const { adminRequest } = require('../scripts/lib');

(async () => {
	console.log('Fetching existing content types for Blocks.allowedTypes...');
	const types = await adminRequest('/api/content-types');
	const allApiIds = types.map((t) => t.apiId);

	console.log('Creating Page content type...');
	const created = await adminRequest('/api/content-types', {
		method: 'POST',
		body: {
			name: 'Page',
			description: 'A custom Page type — see references/create-custom-page-content-type.js for why this exists instead of using native /api/pages.',
			categories: ['Page'],
			fields: [
				{ name: 'Title', apiId: 'title', type: 'text', required: true },
				{ name: 'Slug', apiId: 'slug', type: 'text', required: true },
				{ name: 'Blocks', apiId: 'blocks', type: 'blocks', allowedTypes: allApiIds, required: false },
			],
		},
	});
	console.log('Created:', JSON.stringify(created, null, 2));
	console.log('\nCreate page entries against this type with scripts/entries/create.js, e.g.:');
	console.log(`  node scripts/entries/create.js ${created.apiId} page-data.json`);
})().catch((e) => { console.error(e.message); process.exit(1); });
