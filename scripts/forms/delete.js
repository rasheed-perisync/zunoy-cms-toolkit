#!/usr/bin/env node
// Usage: node delete.js <form-id-or-slug>
// Permanently deletes the selected form. Resolve by slug is supported for
// convenience; the destructive request always uses the form's immutable id.
const { formsRequest, findForm } = require('./lib');

(async () => {
	const key = process.argv[2];
	if (!key) throw new Error('Usage: node delete.js <form-id-or-slug>');
	const form = await findForm(key);
	await formsRequest(`/${encodeURIComponent(form.id)}`, { method: 'DELETE' });
	console.log(`Deleted form ${form.id} (${form.slug}).`);
})().catch((error) => { console.error(error.message); process.exit(1); });
