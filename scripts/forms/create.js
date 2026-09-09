#!/usr/bin/env node
// Usage: node create.js <path-to-form.json>
// form.json: { "name": "Contact form", "slug": "contact-form", "description": "Optional" }
const { formsRequest, formPayload, readJsonArg } = require('./lib');

(async () => {
	const file = process.argv[2];
	if (!file) throw new Error('Usage: node create.js <path-to-form.json>');
	const created = await formsRequest('', {
		method: 'POST',
		body: formPayload(readJsonArg(file), { requireSlug: true }),
	});
	console.log('Created form:', JSON.stringify(created, null, 2));
})().catch((error) => { console.error(error.message); process.exit(1); });
