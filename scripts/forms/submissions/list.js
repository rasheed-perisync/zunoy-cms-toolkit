#!/usr/bin/env node
// Usage: node list.js <form-id-or-slug>
// Lists all submissions for one CMS form. This script is intentionally read-only.
const { formsRequest, findForm } = require('../lib');

(async () => {
	const key = process.argv[2];
	if (!key) throw new Error('Usage: node list.js <form-id-or-slug>');
	const form = await findForm(key);
	const result = await formsRequest(`/${encodeURIComponent(form.id)}/submissions`);
	if (!Array.isArray(result?.submissions)) {
		throw new Error('Expected the Forms API to return a submissions array.');
	}
	console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error.message); process.exit(1); });
