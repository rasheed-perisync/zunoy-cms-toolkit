#!/usr/bin/env node
// Usage: node list.js
// Lists every CMS form visible to the configured tenant.
const { listForms } = require('./lib');

(async () => {
	console.log(JSON.stringify(await listForms(), null, 2));
})().catch((error) => { console.error(error.message); process.exit(1); });
