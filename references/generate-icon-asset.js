#!/usr/bin/env node
// Reference script. This whole pipeline exists because one project made an
// explicit editorial call to bake icons into image tiles server-side instead
// of letting a `blocks`/text field store a raw iconify id string — the
// reasoning being that non-technical content editors can pick an uploaded
// image but can't type/guess an iconify id. That's a content-modeling
// choice, not a CMS requirement: if your instance is fine with an
// icon-name/iconify-id text field (or editors uploading their own images
// directly), you don't need this at all — just use a `text` or `media` field
// normally via content-types/add-field.js. The squircle tile shape below
// (fixed 40x40 authoring space, specific corner radius) is this project's own
// visual design too, not a CMS convention.
//
// Usage: node generate-icon-asset.js <iconify-id> <bgHex> <fgHex> <output.svg> [iconSizePx] [tileSizePx]
//
// IMPORTANT: Iconify ids are frequently wrong on first guess (renamed/missing
// icons, wrong prefix). Before generating a batch of icons, verify they all
// resolve with check-iconify-icons.js -- don't discover a 404 partway through
// writing/uploading a set of N tiles.
//
// Renders a single square "icon tile" SVG (rounded-square tinted background +
// a centered glyph pulled live from Iconify's public icon API) and writes it
// to <output.svg> on disk -- upload the result with scripts/media/upload.js like any other
// asset. This does NOT store an iconify id/string anywhere in CMS data —
// icon-shaped CMS fields should always be media, not an icon-name string.
//
// iconify-id: "<prefix>:<name>", e.g. "mdi:lock", "lucide:users",
//   "heroicons:document-text". Browse icons at https://icon-sets.iconify.design/
// bgHex / fgHex: 6-digit hex, no leading '#', e.g. FEF2F2 / DC2626
// iconSizePx: glyph size inside the tile, default 18
// tileSizePx: output tile width/height, default 40
//
// The background squircle is authored once in a fixed 40x40 coordinate space
// and the whole tile is scaled via the outer width/height vs. viewBox, so the
// corner radius stays proportionally identical at any tileSizePx.

const fs = require('fs');
const path = require('path');

const VIEWBOX_SIZE = 40; // fixed authoring space for the squircle path below -- do not change
const DEFAULT_ICON_SIZE = 18;
const DEFAULT_TILE_SIZE = 40;
const SQUIRCLE_PATH =
	'M0 9C0 4.02944 4.02944 0 9 0H31C35.9706 0 40 4.02944 40 9V31C40 35.9706 35.9706 40 31 40H9C4.02944 40 0 35.9706 0 31V9Z';

function extractSvgInner(svgText) {
	const viewBoxMatch = svgText.match(/viewBox="([\d.\s-]+)"/);
	const viewBox = viewBoxMatch ? viewBoxMatch[1].split(/\s+/).map(Number) : [0, 0, 24, 24];
	const inner = svgText.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
	return { viewBox, inner };
}

(async () => {
	const [iconifyId, bgHexArg, fgHexArg, outputPath, iconSizeArg, tileSizeArg] = process.argv.slice(2);
	if (!iconifyId || !bgHexArg || !fgHexArg || !outputPath) {
		throw new Error(
			'Usage: node generate-icon-asset.js <iconify-id e.g. mdi:lock> <bgHex e.g. FEF2F2> <fgHex e.g. DC2626> <output.svg> [iconSizePx=18] [tileSizePx=40]',
		);
	}
	const [prefix, name] = iconifyId.split(':');
	if (!prefix || !name) throw new Error(`iconify-id must be "<prefix>:<name>", got "${iconifyId}"`);

	const iconSize = Number(iconSizeArg) || DEFAULT_ICON_SIZE;
	const tileSize = Number(tileSizeArg) || DEFAULT_TILE_SIZE;
	if (iconSize >= VIEWBOX_SIZE) throw new Error(`iconSizePx (${iconSize}) must be smaller than the ${VIEWBOX_SIZE}px tile authoring space`);

	// Accept a leading '#' even though it's not asked for -- silently stripping it
	// avoids a "##DCEBFF" doubled-hash / invalid fill that renders as an empty glyph
	// with no error anywhere in the pipeline.
	const bgHex = bgHexArg.replace(/^#/, '');
	const fgHex = fgHexArg.replace(/^#/, '');

	const url = `https://api.iconify.design/${prefix}/${name}.svg?color=%23${fgHex}`;
	const res = await fetch(url);
	if (res.status === 404) {
		throw new Error(`Icon "${iconifyId}" not found on Iconify -- run check-iconify-icons.js first, or browse https://icon-sets.iconify.design/`);
	}
	if (!res.ok) throw new Error(`Iconify fetch failed: ${res.status} ${res.statusText} (${url})`);
	const svgText = await res.text();
	if (!svgText.trim().startsWith('<svg')) {
		throw new Error(`Iconify returned no icon for "${iconifyId}" -- check the id at https://icon-sets.iconify.design/`);
	}

	const { viewBox, inner } = extractSvgInner(svgText);
	const [, , vbW, vbH] = viewBox;
	const scale = iconSize / Math.max(vbW, vbH);
	const offset = (VIEWBOX_SIZE - iconSize) / 2;

	const output = `<svg width="${tileSize}" height="${tileSize}" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="${SQUIRCLE_PATH}" fill="#${bgHex}"/>
<g transform="translate(${offset} ${offset}) scale(${scale})">
${inner}
</g>
</svg>
`;

	fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
	fs.writeFileSync(outputPath, output);
	console.log(`Wrote ${outputPath} (icon: ${iconifyId}, bg: #${bgHex}, fg: #${fgHex}, tile: ${tileSize}px)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
