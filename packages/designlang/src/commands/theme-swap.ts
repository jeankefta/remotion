import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {
	normaliseToHex,
	hexToRgb,
	rgbToHsl,
	generatePalette,
	replaceHue,
} from '../colors';
import {writeFile} from '../output';

function swapPrimaryHue(
	originalColors: string[],
	originalPrimary: string,
	newPrimary: string,
): Record<string, string> {
	const mapping: Record<string, string> = {};
	const origRgb = hexToRgb(originalPrimary);
	const newRgb = hexToRgb(newPrimary);
	if (!origRgb || !newRgb) return mapping;

	const origHsl = rgbToHsl(origRgb.r, origRgb.g, origRgb.b);

	for (const c of originalColors) {
		const rgb = hexToRgb(c);
		if (!rgb) continue;
		const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
		// Only remap colours within ~30° hue of the original primary
		const hueDiff = Math.abs(
			((hsl.h - origHsl.h + 540) % 360) - 180,
		);
		if (hueDiff < 40 && hsl.s > 15) {
			mapping[c] = replaceHue(c, newPrimary);
		}
	}
	return mapping;
}

function generateSwapCss(
	domain: string,
	customProperties: Record<string, string>,
	colorMapping: Record<string, string>,
	palette: Record<string, string>,
	newPrimary: string,
): string {
	const lines: string[] = [`/* Theme swap for ${domain} — primary: ${newPrimary} */`, ':root {'];

	// Swap CSS custom property values
	for (const [k, v] of Object.entries(customProperties)) {
		const swapped = Object.entries(colorMapping).reduce(
			(acc, [from, to]) => acc.replaceAll(from, to),
			v,
		);
		if (swapped !== v) {
			lines.push(`  ${k}: ${swapped};`);
		}
	}

	// Add palette vars
	lines.push('');
	lines.push('  /* Generated brand palette */');
	for (const [shade, hex] of Object.entries(palette)) {
		lines.push(`  --brand-${shade}: ${hex};`);
	}

	lines.push('}');

	// Direct color replacements for non-var usages
	if (Object.keys(colorMapping).length > 0) {
		lines.push('');
		lines.push('/* Direct color overrides */');
		lines.push('/* Apply these manually where CSS variables are not used */');
		for (const [from, to] of Object.entries(colorMapping)) {
			lines.push(`/* ${from} → ${to} */`);
		}
	}

	return lines.join('\n');
}

export async function runThemeSwap(
	targetUrl: string,
	primaryColor: string,
): Promise<void> {
	const newPrimary = normaliseToHex(primaryColor);
	if (!newPrimary) {
		throw new Error(`Invalid color: ${primaryColor}`);
	}

	console.log(chalk.cyan(`Fetching ${targetUrl}…`));
	const design = await fetchDesign(targetUrl);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);

	// Guess original primary as most saturated/frequent color
	const colors = tokens.colors.all;
	let originalPrimary = colors[0] ?? newPrimary;
	let maxSat = 0;
	for (const c of colors.slice(0, 8)) {
		const rgb = hexToRgb(c);
		if (!rgb) continue;
		const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
		if (hsl.s > maxSat) {
			maxSat = hsl.s;
			originalPrimary = c;
		}
	}

	const palette = generatePalette(newPrimary);
	const colorMapping = swapPrimaryHue(colors, originalPrimary, newPrimary);
	const css = generateSwapCss(
		tokens.domain,
		tokens.customProperties,
		colorMapping,
		palette,
		newPrimary,
	);

	const outDir = `designlang-theme-${tokens.domain}`;
	writeFile(path.join(outDir, 'theme-swap.css'), css);
	writeFile(
		path.join(outDir, 'palette.json'),
		JSON.stringify({primary: newPrimary, palette}, null, 2),
	);

	console.log(
		chalk.green(`\n✓ Theme swap complete for ${tokens.domain}`),
	);
	console.log(
		chalk.dim(
			`  Original primary: ${originalPrimary} → New primary: ${newPrimary}`,
		),
	);
	console.log(
		chalk.dim(`  ${Object.keys(colorMapping).length} color replacements`),
	);
	console.log(
		chalk.dim(
			`  Palette: ${Object.values(palette).join('  ')}`,
		),
	);
	console.log(chalk.bold(`\n🎨 Output: ./${outDir}/`));
}
