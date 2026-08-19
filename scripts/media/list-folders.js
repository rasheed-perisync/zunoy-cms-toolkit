#!/usr/bin/env node
// Usage: node list-folders.js [filter]
// Lists existing media folders (id + name) -- check this before create-folder.js
// so you reuse an existing folder (or upload to root with no folderId) instead of
// creating a new one. Optional filter does a case-insensitive substring match on name.
const { adminRequest } = require('../lib');

(async () => {
	const filter = process.argv[2];
	const folders = await adminRequest('/api/media/folders');
	const matched = filter
		? folders.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
		: folders;
	console.log(JSON.stringify(matched.map(({ id, name }) => ({ id, name })), null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
