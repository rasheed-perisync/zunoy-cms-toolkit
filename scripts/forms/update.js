#!/usr/bin/env node
// Usage: node update.js <form-id-or-slug> <path-to-patch.json>
// Safely merges a name/slug/description patch with the current form metadata before
// PUT /api/forms/:id. Tags are deliberately unsupported until taxonomies exist.
const { formsRequest, findForm, formPayload, readJsonArg } = require('./lib');

(async () => {
	const [key, file] = process.argv.slice(2);
	if (!key || !file) throw new Error('Usage: node update.js <form-id-or-slug> <path-to-patch.json>');
	const current = await findForm(key);
	const patch = readJsonArg(file);
	const updated = await formsRequest(`/${encodeURIComponent(current.id)}`, {
		method: 'PUT',
		body: formPayload({
			name: current.name,
			slug: current.slug,
			description: current.description,
			...patch,
		}),
	});
	console.log('Updated form:', JSON.stringify(updated, null, 2));
})().catch((error) => { console.error(error.message); process.exit(1); });
