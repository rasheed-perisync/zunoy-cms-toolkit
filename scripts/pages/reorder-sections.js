#!/usr/bin/env node
// Usage: node reorder-sections.js <ids.json> [--start=0]
//
// Sets `sectionOrder` on a list of section entries to match the order you
// list them in — the CMS has no dedicated reorder endpoint; this is the same
// "fetch entry -> set data.sectionOrder -> PUT full entry back" loop used
// directly via the API in real projects, generalized to take any id list
// instead of hardcoding one page's ids inline.
//
// ids.json: a flat JSON array of entry ids, in the order you want them to
// render, e.g. ["6a604b07...", "6a6c3b42...", ...]. Get these from
// pages/get.js --admin or entries/list.js first.
//
// --start=N: sectionOrder assigned to the first id (default 0); subsequent
// ids get start+1, start+2, ...
const { adminRequest, readJsonArg } = require('../lib');

(async () => {
	const args = process.argv.slice(2);
	const file = args.find((a) => !a.startsWith('--'));
	const startFlag = args.find((a) => a.startsWith('--start='));
	const start = startFlag ? Number(startFlag.slice('--start='.length)) : 0;
	if (!file) throw new Error('Usage: node reorder-sections.js <ids.json> [--start=0]');

	const ids = readJsonArg(file);
	if (!Array.isArray(ids)) throw new Error('ids.json must be a flat JSON array of entry ids');

	for (let i = 0; i < ids.length; i++) {
		const id = ids[i];
		const order = start + i;
		const current = await adminRequest(`/api/entries/${id}`);
		const data = { ...current.data, sectionOrder: order };
		await adminRequest(`/api/entries/${id}`, { method: 'PUT', body: { status: current.status, data } });
		console.log(`${id} -> sectionOrder ${order}`);
	}
	console.log(`\nReordered ${ids.length} entries.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
