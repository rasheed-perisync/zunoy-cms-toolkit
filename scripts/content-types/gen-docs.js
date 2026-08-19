#!/usr/bin/env node
// Usage: node gen-docs.js <output.md> [apiId-substring-filter]
//
// Generates a markdown reference doc of every content type's fields (nested
// subFields included), pulled live from /api/content-types. Optional second arg
// filters to content types whose apiId contains that substring.
const fs = require('fs');
const { adminRequest } = require('../lib');

function renderFields(fields, indent) {
	let out = '';
	for (const f of fields || []) {
		const opts = f.options ? ` [${f.options.join('/')}]` : '';
		const allowed = f.allowedTypes ? ` allowedTypes[${f.allowedTypes.join(',')}]` : '';
		const target = f.targetApiId ? ` -> ${f.targetApiId}` : '';
		out += `${indent}- \`${f.apiId}\` (${f.type}, ${f.required ? 'required' : 'optional'})${opts}${allowed}${target}\n`;
		if (f.subFields) out += renderFields(f.subFields, indent + '  ');
	}
	return out;
}

(async () => {
	const [outputPath, filter] = process.argv.slice(2);
	if (!outputPath) throw new Error('Usage: node gen-docs.js <output.md> [apiId-substring-filter]');

	const list = await adminRequest('/api/content-types');
	const targets = (filter ? list.filter((t) => t.apiId.includes(filter)) : list)
		.sort((a, b) => a.apiId.localeCompare(b.apiId));

	let doc = `## Content types (${targets.length} of ${list.length})\n\n`;
	for (const t of targets) {
		const full = await adminRequest(`/api/content-types/${t.id}`);
		doc += `### ${full.name} (\`${full.apiId}\`)\n\n`;
		for (const img of full.previewImages || []) doc += `![${full.apiId} preview](${img})\n`;
		doc += renderFields(full.fields, '');
		doc += '\n';
		console.log('done', full.apiId);
	}

	fs.writeFileSync(outputPath, doc);
	console.log(`Wrote ${outputPath} (${doc.length} chars)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
