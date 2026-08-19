#!/usr/bin/env node
// Usage: node clear-required.js <apiId> [apiId ...]
//
// Recursively clears `required: true` on every field of the given content
// type(s), including nested repeater/blocks subFields and allowedTypes field
// trees. Useful when a batch of content types has drafts with incomplete data
// that need to publish anyway — rather than hand-fixing every missing field,
// relax validation across the batch in one pass. Prints how many fields
// changed per type; skips types with nothing to change.
//
// Note: if a `blocks` field's allowedTypes entries are just apiId strings
// (not embedded field-tree objects), there's nothing to recurse into there —
// clear required on the target types themselves too if needed.
const { adminRequest, findContentType } = require('../lib');

function clearRequired(field) {
	let changed = 0;
	if (field.required === true) {
		field.required = false;
		changed++;
	}
	if (Array.isArray(field.subFields)) {
		for (const sub of field.subFields) changed += clearRequired(sub);
	}
	if (Array.isArray(field.allowedTypes)) {
		for (const allowed of field.allowedTypes) {
			if (allowed && Array.isArray(allowed.fields)) {
				for (const f of allowed.fields) changed += clearRequired(f);
			}
		}
	}
	return changed;
}

(async () => {
	const apiIds = process.argv.slice(2);
	if (apiIds.length === 0) throw new Error('Usage: node clear-required.js <apiId> [apiId ...]');

	for (const apiId of apiIds) {
		let ct;
		try {
			ct = await findContentType(apiId);
		} catch {
			console.log(`${apiId}: NOT FOUND, skipping`);
			continue;
		}

		let changed = 0;
		for (const field of ct.fields) changed += clearRequired(field);

		if (changed === 0) {
			console.log(`${apiId}: no required fields found, skipping`);
			continue;
		}

		try {
			await adminRequest(`/api/content-types/${ct.id}`, { method: 'PUT', body: ct });
			console.log(`${apiId}: cleared required on ${changed} field(s)`);
		} catch (e) {
			console.log(`${apiId}: FAILED ${e.message}`);
		}
	}
})().catch((e) => { console.error(e.message); process.exit(1); });
