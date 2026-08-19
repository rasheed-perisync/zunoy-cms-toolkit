#!/usr/bin/env node
// Usage: node create-folder.js <folder-name>
// Prints the created folder's id — pass it as folderId to upload.js to group uploads.
const { requireEnv, adminHeaders } = require('../lib');

(async () => {
	const name = process.argv[2];
	if (!name) throw new Error('Usage: node create-folder.js <folder-name>');
	const { BASE_URL } = requireEnv();
	const res = await fetch(`${BASE_URL}/api/media/folders`, {
		method: 'POST',
		headers: adminHeaders(),
		body: JSON.stringify({ name }),
	});
	if (!res.ok) throw new Error(`Create folder failed: ${res.status} ${await res.text()}`);
	console.log(JSON.stringify(await res.json(), null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
