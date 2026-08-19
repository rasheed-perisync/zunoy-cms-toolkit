#!/usr/bin/env node
// Reference script, not a general CLI tool — read and adapt before running.
//
// Companion to create-custom-page-content-type.js: an SEO embedded type meant
// to be referenced from a custom Page type's own `reference`-typed "seo"
// field (see docs/admin-api.md's Reference-field resolution section for how
// `reference` fields get resolved on read). Only useful alongside the custom
// Page pattern — if you're using native /api/pages, put SEO fields directly
// on the Page via pages/update-config.js instead.
const { adminRequest } = require('../scripts/lib');

(async () => {
	console.log('Creating SEO content type...');
	const created = await adminRequest('/api/content-types', {
		method: 'POST',
		body: {
			name: 'SEO',
			categories: ['Page'],
			fields: [
				{ name: 'Title', apiId: 'title', type: 'text', required: true },
				{ name: 'Description', apiId: 'description', type: 'text', required: false },
				{ name: 'Image', apiId: 'image', type: 'media', required: false },
				{ name: 'Index', apiId: 'index', type: 'boolean', required: true },
			],
		},
	});
	console.log('Created:', JSON.stringify(created, null, 2));
	console.log(`\nAdd a "seo" reference field (type: "reference", targetApiId: "${created.apiId}") to your custom Page type to use this.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
