#!/usr/bin/env node
// Reference script — see generate-icon-asset.js's header for why this exists
// (a project-specific editorial call to require `media` icon fields, not a
// CMS requirement) and why the tile shape is that project's own design.
//
// Usage: node generate-emoji-icon-asset.js <emoji> <bgHex> <output.svg> [tileSizePx] [fontSizePx]
//
// Renders a single square "icon tile" SVG (tinted rounded-square background +
// a centered emoji glyph) and writes it to <output.svg> on disk -- upload the
// result with scripts/media/upload.js like any other asset. Use this instead of
// generate-icon-asset.js when a design's per-item icons are actual emoji on a
// tinted background rather than mdi/lucide-style line-icon tiles.
//
// emoji: a single emoji character, e.g. "🌐" (quote it in the shell)
// bgHex: 6-digit hex, no leading '#', e.g. EFF6FF
// tileSizePx: output tile width/height, default 40
// fontSizePx: emoji glyph size, default ~45% of tileSizePx (scales with it unless overridden)

const fs = require('fs');
const path = require('path');

const DEFAULT_TILE_SIZE = 40;
const CORNER_RADIUS_RATIO = 9 / 40; // matches generate-icon-asset.js's squircle proportions

(async () => {
	const [emoji, bgHexArg, outputPath, tileSizeArg, fontSizeArg] = process.argv.slice(2);
	if (!emoji || !bgHexArg || !outputPath) {
		throw new Error(
			'Usage: node generate-emoji-icon-asset.js <emoji e.g. "🌐"> <bgHex e.g. EFF6FF> <output.svg> [tileSizePx=40] [fontSizePx]',
		);
	}

	const bgHex = bgHexArg.replace(/^#/, '');
	const tileSize = Number(tileSizeArg) || DEFAULT_TILE_SIZE;
	const fontSize = Number(fontSizeArg) || Math.round(tileSize * 0.45);
	const radius = Math.round(tileSize * CORNER_RADIUS_RATIO);

	// The <text> element needs its own explicit fill -- the root svg's fill="none"
	// (needed so the rect/path shapes below don't force a fill) otherwise cascades
	// to it too, rendering the glyph invisible in any renderer that falls back to a
	// monochrome glyph outline instead of a color-emoji font.
	const output = `<svg width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="${tileSize}" height="${tileSize}" rx="${radius}" fill="#${bgHex}"/>
<text x="${tileSize / 2}" y="${tileSize / 2 + fontSize * 0.36}" font-size="${fontSize}" text-anchor="middle" fill="black">${emoji}</text>
</svg>
`;

	fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
	fs.writeFileSync(outputPath, output);
	console.log(`Wrote ${outputPath} (emoji: ${emoji}, bg: #${bgHex}, tile: ${tileSize}px)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
