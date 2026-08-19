#!/usr/bin/env node
// Usage: node add-field.js <apiId-or-id> <path-to-field.json> [--parent=<subFields-parent-apiId>]
//
// Generalizes the "fetch type -> push one field onto .fields -> PUT back" shape
// that shows up dozens of times as one-off scripts in real CMS projects. Idempotent:
// if a field with the same apiId already exists at the target level, it's a no-op.
//
// field.json is a single field definition object:
// { "name": "Platforms", "apiId": "platforms", "type": "repeater", "required": false,
//   "subFields": [ { "name": "Platform", "apiId": "platform", "type": "select", "options": ["iOS","Android"] } ] }
//
// --parent=<apiId>: instead of appending to the content type's top-level `fields`,
// append into the `subFields` array of the repeater/blocks field with that apiId
// (one level deep only).
const { adminRequest, findContentType, readJsonArg } = require('../lib');

(async () => {
	const [key, file, parentFlag] = process.argv.slice(2);
	if (!key || !file) {
		throw new Error('Usage: node add-field.js <apiId-or-id> <path-to-field.json> [--parent=<subFields-parent-apiId>]');
	}
	const newField = readJsonArg(file);
	if (!newField.apiId) throw new Error('field.json must include an "apiId"');

	const ct = await findContentType(key);
	const parentApiId = parentFlag?.startsWith('--parent=') ? parentFlag.slice('--parent='.length) : null;

	if (parentApiId) {
		const parent = ct.fields.find((f) => f.apiId === parentApiId);
		if (!parent) throw new Error(`No field with apiId "${parentApiId}" found on "${ct.apiId}"`);
		parent.subFields = parent.subFields || [];
		if (parent.subFields.some((f) => f.apiId === newField.apiId)) {
			console.log(`"${newField.apiId}" already exists under "${parentApiId}", skipping.`);
			return;
		}
		parent.subFields.push(newField);
	} else {
		if (ct.fields.some((f) => f.apiId === newField.apiId)) {
			console.log(`"${newField.apiId}" already exists on "${ct.apiId}", skipping.`);
			return;
		}
		ct.fields.push(newField);
	}

	const updated = await adminRequest(`/api/content-types/${ct.id}`, { method: 'PUT', body: ct });
	console.log(`Added "${newField.apiId}" to "${ct.apiId}"${parentApiId ? ` (under ${parentApiId})` : ''}.`);
	console.log(JSON.stringify(updated.fields, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
