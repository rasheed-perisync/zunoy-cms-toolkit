#!/usr/bin/env node
// Usage: node find-unused-dynamic-zone-components.js [path/to/backup.json]
//
// Finds content types that are never referenced as an allowedType inside another
// content type's "blocks" field (i.e. never usable as a nested/dynamic-zone
// component) — likely dead/orphaned schemas from a cut design.
//
// With no arg, fetches live from /api/content-types. Pass a path to reuse a
// backup-content-types.js-style dump instead (an array of content-type objects)
// to avoid hitting the CMS again.
const fs = require('fs');
const { adminRequest } = require('../lib');

const IGNORE = new Set(['section']);

function collectAllowedTypes(fields, out) {
	for (const field of fields || []) {
		if (field.type === 'blocks' && Array.isArray(field.allowedTypes)) {
			for (const t of field.allowedTypes) out.add(t);
		}
		if (Array.isArray(field.subFields)) collectAllowedTypes(field.subFields, out);
	}
}

(async () => {
	const backupPath = process.argv[2];
	const models = backupPath
		? JSON.parse(fs.readFileSync(backupPath, 'utf8'))
		: await adminRequest('/api/content-types');

	const referenced = new Set();
	for (const model of models) collectAllowedTypes(model.fields, referenced);

	const allApiIds = models.map((m) => m.apiId);
	const unused = allApiIds.filter((apiId) => !referenced.has(apiId) && !IGNORE.has(apiId));

	console.log(`${models.length} content types total`);
	console.log(`${referenced.size} distinct apiIds referenced in some blocks field`);
	console.log(`${unused.length} content types never referenced as a blocks allowedType:\n`);
	for (const apiId of unused) console.log(`- ${apiId}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
