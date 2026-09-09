#!/usr/bin/env node
// Usage: node create.js <form-id-or-slug> <submission.json> [branch]
//
// Submits JSON through the public CMS Forms endpoint. The branch defaults to
// CMS_BRANCH, then `main`; it is part of the endpoint path, not a query param.
const {
	formsPublicRequest,
	findForm,
	readJsonArg,
} = require('../lib');

(async () => {
	const [key, file, branch = process.env.CMS_BRANCH || 'main'] = process.argv.slice(2);
	if (!key || !file) {
		throw new Error('Usage: node create.js <form-id-or-slug> <submission.json> [branch]');
	}
	const form = await findForm(key);
	const submission = readJsonArg(file);
	if (!submission || Array.isArray(submission) || typeof submission !== 'object') {
		throw new Error('Submission JSON must be an object.');
	}

	const result = await formsPublicRequest(
		`/v1/forms/${encodeURIComponent(branch)}/${encodeURIComponent(form.slug)}`,
		{ method: 'POST', body: submission },
	);
	console.log('Created submission:', JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error.message); process.exit(1); });
