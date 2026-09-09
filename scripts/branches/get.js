#!/usr/bin/env node
// Usage: node get.js [branch-id-or-slug]
//
// Read-only branch lookup for the CMS Forms API host. With no argument it lists
// all branches; with an id, name, or slug it prints the matching branch.
const { requireEnv } = require('../lib');

const DEFAULT_CMS_BASE_URL = 'https://api.zunoy.com/api/v1/cms';

(async () => {
	const { API_KEY } = requireEnv();
	const baseUrl = (process.env.CMS_FORMS_BASE_URL || DEFAULT_CMS_BASE_URL).replace(/\/$/, '');
	const res = await fetch(`${baseUrl}/api/branches`, {
		headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
	});
	const text = await res.text();
	let branches;
	try { branches = text ? JSON.parse(text) : []; } catch { throw new Error('CMS branches API returned non-JSON data.'); }
	if (!res.ok) throw new Error(`GET /api/branches -> ${res.status}: ${typeof branches === 'string' ? branches : JSON.stringify(branches)}`);
	if (!Array.isArray(branches)) throw new Error('Expected the CMS branches API to return an array.');

	const key = process.argv[2];
	if (!key) {
		console.log(JSON.stringify(branches, null, 2));
		return;
	}
	const branch = branches.find((item) => item.id === key || item.name === key || item.slug === key);
	if (!branch) throw new Error(`No branch found with id, name, or slug "${key}".`);
	console.log(JSON.stringify(branch, null, 2));
})().catch((error) => { console.error(error.message); process.exit(1); });
