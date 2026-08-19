#!/usr/bin/env node
// Usage: node find-type-usages.js <apiId> [apiId ...] [path/to/backup.json]
//
// Reverse lookup, complementing find-unused-dynamic-zone-components.js: for
// each apiId given, shows every content type + field path where it appears
// inside a `blocks` field's `allowedTypes` (including nested subFields).
// Useful before deleting/renaming a type, to see what actually references it.
//
// With no backup path, fetches live from /api/content-types. Pass a path to
// reuse a backup-content-types.js-style dump instead (an array of
// content-type objects) to avoid hitting the CMS again.
const fs = require('fs');
const { adminRequest } = require('../lib');

function findUsages(fields, path, apiId, hits) {
	for (const field of fields || []) {
		const fieldPath = path ? `${path}.${field.apiId}` : field.apiId;
		if (field.type === 'blocks' && Array.isArray(field.allowedTypes) && field.allowedTypes.includes(apiId)) {
			hits.push(fieldPath);
		}
		if (Array.isArray(field.subFields)) findUsages(field.subFields, fieldPath, apiId, hits);
	}
}

(async () => {
	const args = process.argv.slice(2);
	if (args.length === 0) throw new Error('Usage: node find-type-usages.js <apiId> [apiId ...] [path/to/backup.json]');

	const lastArg = args[args.length - 1];
	const usingBackup = fs.existsSync(lastArg);
	const apiIds = usingBackup ? args.slice(0, -1) : args;
	if (apiIds.length === 0) throw new Error('At least one apiId is required');

	const models = usingBackup
		? JSON.parse(fs.readFileSync(lastArg, 'utf8'))
		: await adminRequest('/api/content-types');

	for (const apiId of apiIds) {
		console.log(`\n=== ${apiId} ===`);
		const contentType = models.find((m) => m.apiId === apiId);
		console.log(contentType ? `  content type exists (id: ${contentType.id})` : '  content type does NOT exist');

		let found = false;
		for (const model of models) {
			const hits = [];
			findUsages(model.fields, '', apiId, hits);
			if (hits.length) {
				found = true;
				for (const h of hits) console.log(`  used in ${model.apiId} -> ${h}`);
			}
		}
		if (!found) console.log('  not referenced as an allowedType anywhere');
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
