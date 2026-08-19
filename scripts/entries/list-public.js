#!/usr/bin/env node
// Usage: node list-public.js <typeApiId> [path/to/filter.json] [branch]
//
// Public-surface listing: GET /v1/:typeApiId?filter[k]=v&branch=b — published
// entries on one branch only (default branch if `branch` omitted), read-only,
// X-Zunoy-Key. This is the read path your production site should use for
// anything user-facing; entries/list.js (admin surface) mixes drafts and every
// branch together and needs a real API key, not a public-safe one.
//
// filter.json (optional): a flat object of field-value equality filters, e.g.
// { "category": "pricing" }.
const { publicRequest, readJsonArg } = require('../lib');

(async () => {
	const [typeApiId, filterFile, branch] = process.argv.slice(2);
	if (!typeApiId) throw new Error('Usage: node list-public.js <typeApiId> [path/to/filter.json] [branch]');
	const filter = filterFile ? readJsonArg(filterFile) : undefined;
	const json = await publicRequest(`/v1/${typeApiId}`, { branch, filter });
	const entries = json.data ?? json;
	console.log(JSON.stringify(entries, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
