#!/usr/bin/env node
// Usage: node upload.js <path-to-file> [folderId]
// Uploads a file to the media library, optionally into a folder (create one first
// with create-folder.js — a plain "folder" string field does NOT associate the
// upload with a folder; you need the folder's id).
// Requires Node 18+ (global FormData/Blob/fetch).
const fs = require('fs');
const path = require('path');
const { requireEnv, mimeTypeFor } = require('../lib');

(async () => {
	const [filePath, folderId] = process.argv.slice(2);
	if (!filePath) throw new Error('Usage: node upload.js <path-to-file> [folderId]');
	const { BASE_URL, API_KEY } = requireEnv();

	const buffer = fs.readFileSync(filePath);
	const mimeType = mimeTypeFor(filePath); // see lib.js: an untyped Blob gets stored as octet-stream
	const form = new FormData();
	form.append('file', new Blob([buffer], { type: mimeType }), path.basename(filePath));
	if (folderId) form.append('folderId', folderId);

	const res = await fetch(`${BASE_URL}/api/media/upload`, {
		method: 'POST',
		headers: { 'X-API-Key': API_KEY }, // no Content-Type — fetch sets the multipart boundary itself
		body: form,
	});
	if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
	console.log(JSON.stringify(await res.json(), null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
