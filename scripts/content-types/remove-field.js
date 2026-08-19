#!/usr/bin/env node
// Usage: node remove-field.js <apiId-or-id> <field-apiId> [--parent=<subFields-parent-apiId>]
//
// Generalizes the mirror shape of add-field.js: fetch type, filter one field out of
// .fields (or a parent's .subFields), PUT back. No-op (with a message) if the field
// isn't there.
const { adminRequest, findContentType } = require('../lib');

(async () => {
	const [key, fieldApiId, parentFlag] = process.argv.slice(2);
	if (!key || !fieldApiId) {
		throw new Error('Usage: node remove-field.js <apiId-or-id> <field-apiId> [--parent=<subFields-parent-apiId>]');
	}
	const ct = await findContentType(key);
	const parentApiId = parentFlag?.startsWith('--parent=') ? parentFlag.slice('--parent='.length) : null;

	if (parentApiId) {
		const parent = ct.fields.find((f) => f.apiId === parentApiId);
		if (!parent) throw new Error(`No field with apiId "${parentApiId}" found on "${ct.apiId}"`);
		const before = (parent.subFields || []).length;
		parent.subFields = (parent.subFields || []).filter((f) => f.apiId !== fieldApiId);
		if (parent.subFields.length === before) {
			console.log(`"${fieldApiId}" not found under "${parentApiId}", nothing to do.`);
			return;
		}
	} else {
		const before = ct.fields.length;
		ct.fields = ct.fields.filter((f) => f.apiId !== fieldApiId);
		if (ct.fields.length === before) {
			console.log(`"${fieldApiId}" not found on "${ct.apiId}", nothing to do.`);
			return;
		}
	}

	const updated = await adminRequest(`/api/content-types/${ct.id}`, { method: 'PUT', body: ct });
	console.log(`Removed "${fieldApiId}" from "${ct.apiId}"${parentApiId ? ` (under ${parentApiId})` : ''}.`);
	console.log(JSON.stringify(updated.fields, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
