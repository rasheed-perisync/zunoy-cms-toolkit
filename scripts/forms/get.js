#!/usr/bin/env node
// Usage: node get.js <form-id-or-slug>
// The Forms API currently has no GET /api/forms/:id route, so this resolves
// the requested form from the authenticated collection response.
const { findForm } = require('./lib');

(async () => {
	const key = process.argv[2];
	if (!key) throw new Error('Usage: node get.js <form-id-or-slug>');
	console.log(JSON.stringify(await findForm(key), null, 2));
})().catch((error) => { console.error(error.message); process.exit(1); });
