#!/usr/bin/env node
// Usage: node upload-and-assign.js <path-to-file> <entry|content-type> <id-or-apiId> <fieldPath> [folderId]
//
// Uploads a local file to the media library, then PATCHes the resulting URL onto
// a field of an entry or a content type (e.g. a logo, a preview image, a signup
// background). Generalizes the "upload -> assign to a specific known field" one-off
// scripts that only differed in which field they patched.
//
// target: "entry" -> merges into that entry's `data` object at fieldPath (top-level
//         key only, e.g. "logo" or "backgroundImage").
//         "content-type" -> merges into the content type record itself (e.g.
//         "previewImage") using the existing safe get->merge->PUT pattern.
const fs = require('fs');
const path = require('path');
const { requireEnv, adminHeaders, adminRequest, findContentType } = require('../lib');

const MIME_TYPES = {
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
};

async function uploadFile(filePath, folderId) {
	const { BASE_URL, API_KEY } = requireEnv();
	const buffer = fs.readFileSync(filePath);
	const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
	const form = new FormData();
	form.append('file', new Blob([buffer], { type: mimeType }), path.basename(filePath));
	if (folderId) form.append('folderId', folderId);

	const res = await fetch(`${BASE_URL}/api/media/upload`, {
		method: 'POST',
		headers: { 'X-API-Key': API_KEY },
		body: form,
	});
	if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
	return res.json();
}

(async () => {
	const [filePath, target, targetId, fieldPath, folderId] = process.argv.slice(2);
	if (!filePath || !target || !targetId || !fieldPath) {
		throw new Error('Usage: node upload-and-assign.js <path-to-file> <entry|content-type> <id-or-apiId> <fieldPath> [folderId]');
	}
	if (target !== 'entry' && target !== 'content-type') {
		throw new Error('target must be "entry" or "content-type"');
	}

	const media = await uploadFile(filePath, folderId);
	console.log(`Uploaded -> ${media.url}`);

	if (target === 'entry') {
		const current = await adminRequest(`/api/entries/${targetId}`);
		const data = { ...current.data, [fieldPath]: media.url };
		const updated = await adminRequest(`/api/entries/${targetId}`, {
			method: 'PUT',
			body: { status: current.status, data },
		});
		console.log(`Assigned to entry ${targetId}.${fieldPath}`);
		console.log(JSON.stringify(updated, null, 2));
	} else {
		const ct = await findContentType(targetId);
		const updated = await adminRequest(`/api/content-types/${ct.id}`, {
			method: 'PUT',
			body: { ...ct, [fieldPath]: media.url },
		});
		console.log(`Assigned to content type "${ct.apiId}".${fieldPath}`);
		console.log(JSON.stringify(updated, null, 2));
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
