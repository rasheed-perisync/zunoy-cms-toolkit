#!/usr/bin/env node
// Shows whether the website is behind the CMS: `dirty: true` means something
// was published (or changed) since the last site revalidation.
// Usage: node status.js [branch]
//
// Same data as the web app's "Publish to website" button state
// (GET /api/publish-status → { dirty, lastPublishedAt }).
const { adminRequest } = require('../lib');

(async () => {
	const branch = process.argv[2];
	const status = await adminRequest('/api/publish-status', { branch });
	console.log(`dirty:           ${status?.dirty ?? '?'}`);
	console.log(`lastPublishedAt: ${status?.lastPublishedAt ?? 'never'}`);
	if (status?.dirty) console.log('\nThe site is behind the CMS. Run revalidate.js to push the changes live.');
})().catch((e) => { console.error(e.message); process.exit(1); });
