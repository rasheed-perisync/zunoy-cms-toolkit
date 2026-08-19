#!/usr/bin/env node
// Usage: node create-embedded-pair.js <path-to-pair.json>
//
// Creates a private "embedded" child type followed by its parent/owner type, in the
// required order (child must exist before the parent references it). Use this when a
// parent type needs a plain nested single-object field (e.g. data.total.label /
// data.total.price) with no natural top-level field type for it.
//
// pair.json shape:
// {
//   "child": {
//     "name": "My Embedded Type",
//     "fields": [ { "name": "Label", "apiId": "label", "type": "text", "required": false, "order": 0 } ]
//   },
//   "parent": {
//     "name": "My Parent Type",
//     "apiId": "my-parent-type",
//     "showInPageManager": true,
//     "categories": ["Pricing"],
//     "fields": [
//       { "name": "Title", "apiId": "title", "type": "richtext", "required": false, "order": 0 },
//       { "name": "Total", "apiId": "total", "type": "blocks", "allowedTypes": ["REPLACE_WITH_CHILD_APIID"], "single": true, "required": false, "order": 1 }
//     ]
//   }
// }
//
// parent.apiId is REQUIRED (not just parent.name) — the child's ownerType must
// be the parent's apiId (confirmed against a real instance, see
// cms-scripts/reference/create-embedded-content-type-pattern.js's
// `ownerType: "my-parent-type", // apiId the owner type will have`), and the
// parent doesn't exist yet at child-creation time to derive it from. Since
// apiId is normally auto-derived from name on creation and this script can't
// safely replicate that slugification, you must supply the apiId you expect
// the parent to get yourself and pass the SAME value as `parent.apiId` — this
// script sends it through untouched on the parent's own create call too, so
// what you wrote is what you get, no guessing required.
//
// Each field also includes an explicit `order` in the confirmed-working
// example above (0, 1, 2, ...) — not confirmed whether the CMS requires it,
// but set it explicitly to be safe rather than relying on a default.
const { adminRequest, readJsonArg } = require('../lib');

(async () => {
	const file = process.argv[2];
	if (!file) throw new Error('Usage: node create-embedded-pair.js <path-to-pair.json>');
	const { child, parent } = readJsonArg(file);
	if (!child || !parent) throw new Error('pair.json must have both "child" and "parent" keys');
	if (!parent.apiId) throw new Error('parent.apiId is required — see this script\'s header comment for why');

	console.log('Creating embedded child type...');
	const childCreated = await adminRequest('/api/content-types', {
		method: 'POST',
		body: { ...child, scope: 'embedded', ownerType: parent.apiId },
	});
	console.log(`Child created: ${childCreated.apiId} (${childCreated.id})`);
	if (childCreated.ownerType && childCreated.ownerType !== parent.apiId) {
		console.log(`NOTE: server stored ownerType as "${childCreated.ownerType}", not "${parent.apiId}" as sent — double-check this pair after the parent is created.`);
	}

	const parentJson = JSON.stringify(parent).replaceAll('REPLACE_WITH_CHILD_APIID', childCreated.apiId);
	const parentBody = JSON.parse(parentJson);

	console.log('Creating parent/owner type...');
	const parentCreated = await adminRequest('/api/content-types', { method: 'POST', body: parentBody });
	console.log(`Parent created: ${parentCreated.apiId} (${parentCreated.id})`);
	if (parentCreated.apiId !== parent.apiId) {
		console.log(`WARNING: parent's actual apiId is "${parentCreated.apiId}", not "${parent.apiId}" you supplied — the child's ownerType (sent as "${parent.apiId}") likely does NOT match. Re-check with content-types/get.js on both, and consider content-types/update.js on the child to correct ownerType if needed.`);
	}

	console.log('\nDone. When authoring entries, tag the embedded object with:');
	console.log(`  { "_type": "${childCreated.apiId}", ... }`);
})().catch((e) => { console.error(e.message); process.exit(1); });
