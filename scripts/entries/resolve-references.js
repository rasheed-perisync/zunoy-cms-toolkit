#!/usr/bin/env node
// Usage: node resolve-references.js <entry-id>
//
// Fetches an entry and recursively resolves every `reference`-typed field
// (which stores a bare entry id, or array of ids, plus `targetApiId` on the
// schema) into the actual referenced entry/entries — the CMS's admin API
// does NOT do this for you; a `reference` field value straight off GET
// /api/entries/:id is just an id string. Also recurses into `blocks` and
// `repeater` field values (using each `blocks` value's own `_type` to look
// up its sub-schema) since those can nest further `reference` fields.
//
// This is a standalone port of the recursive resolution logic a production
// site's own CMS client implements for rendering (see
// utils/zunoy-cms.js's populateReferences() in the zunoy-website-headless-strapi
// codebase, if you have it checked out, for the original with preview/branch
// handling layered on top — this version is the bare admin-surface
// recursion, no caching/preview distinction).
const { adminRequest } = require('../lib');

async function resolveReferences(data, model, schema) {
	if (!data || typeof data !== 'object') return data;
	if (Array.isArray(data)) {
		return Promise.all(data.map((item) => resolveReferences(item, model, schema)));
	}

	let currentModel = model;
	if (data.__component || data._type) {
		const componentId = data.__component || data._type;
		currentModel = schema.find((m) => m.apiId === componentId);
	}
	if (!currentModel) return data;

	const resolved = { ...data };
	for (const field of currentModel.fields || []) {
		const value = resolved[field.apiId];
		if (value == null) continue;

		if (field.type === 'reference' && typeof value === 'string') {
			try {
				resolved[field.apiId] = await adminRequest(`/api/entries/${value}`);
			} catch (e) {
				console.error(`Failed to resolve reference ${field.apiId}=${value}: ${e.message}`);
			}
		} else if (field.type === 'reference' && Array.isArray(value)) {
			resolved[field.apiId] = await Promise.all(
				value.map((id) => adminRequest(`/api/entries/${id}`).catch((e) => {
					console.error(`Failed to resolve reference ${field.apiId}[]=${id}: ${e.message}`);
					return null;
				})),
			);
		} else if (field.type === 'blocks' || field.type === 'repeater' || typeof value === 'object') {
			resolved[field.apiId] = await resolveReferences(value, field, schema);
		}
	}
	return resolved;
}

(async () => {
	const entryId = process.argv[2];
	if (!entryId) throw new Error('Usage: node resolve-references.js <entry-id>');

	const entry = await adminRequest(`/api/entries/${entryId}`);
	const schema = await adminRequest('/api/content-types');
	const model = schema.find((m) => m.apiId === entry.contentTypeApiId);
	if (!model) throw new Error(`No content type found with apiId "${entry.contentTypeApiId}" (from entry.contentTypeApiId)`);

	entry.data = await resolveReferences(entry.data, model, schema);
	console.log(JSON.stringify(entry, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
