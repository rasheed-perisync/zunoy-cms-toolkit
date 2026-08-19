#!/usr/bin/env node
// Usage: node wipe-collection.js <pages|entries> [contentType-apiId-or-id (entries only)] [--yes]
//
// Destructive bulk delete. Generalizes one-off "list -> loop -> DELETE" scripts.
// Requires --yes to actually delete; without it, does a dry-run listing what
// would be deleted. Confirm with the user before running with --yes.
const { adminRequest, findContentType } = require('../lib');

(async () => {
	const args = process.argv.slice(2);
	const CONFIRM = args.includes('--yes');
	const kind = args[0];
	if (kind !== 'pages' && kind !== 'entries') {
		throw new Error('Usage: node wipe-collection.js <pages|entries> [contentType-apiId-or-id (entries only)] [--yes]');
	}

	let items, deleteOne, describe;
	if (kind === 'pages') {
		items = await adminRequest('/api/pages');
		deleteOne = (p) => adminRequest(`/api/pages/${p.id}`, { method: 'DELETE' });
		describe = (p) => `${p.title} (${p.slug})`;
	} else {
		const ctKey = args[1];
		if (!ctKey) throw new Error('entries mode requires a content-type apiId-or-id as the second arg');
		const ct = await findContentType(ctKey);
		const raw = await adminRequest(`/api/content-types/${ct.id}/entries`);
		items = Array.isArray(raw) ? raw : raw?.entries || raw?.data || [];
		deleteOne = (e) => adminRequest(`/api/entries/${e.id}`, { method: 'DELETE' });
		describe = (e) => `${e.id}`;
	}

	if (items.length === 0) {
		console.log(`Nothing to wipe (0 ${kind}).`);
		return;
	}

	if (!CONFIRM) {
		console.log(`[dry run] would delete ${items.length} ${kind}:`);
		items.forEach((i) => console.log(`  - ${describe(i)}`));
		console.log('\nRe-run with --yes to actually delete.');
		return;
	}

	console.log(`Deleting ${items.length} ${kind}...`);
	let failed = 0;
	for (const item of items) {
		try {
			await deleteOne(item);
			console.log(`Deleted: ${describe(item)}`);
		} catch (e) {
			failed++;
			console.error(`FAILED: ${describe(item)} -> ${e.message}`);
		}
	}
	console.log(`\nDone. ${items.length - failed} deleted, ${failed} failed.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
