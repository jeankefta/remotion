import {normaliseToHex} from './colors';
import type {DesignTokens} from './types';

const COLOR_RE =
	/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;
const FONT_FAMILY_RE = /font-family\s*:\s*([^;{}]+)/gi;
const FONT_SIZE_RE = /font-size\s*:\s*([^;{}]+)/gi;
const FONT_WEIGHT_RE = /font-weight\s*:\s*([^;{}]+)/gi;
const LINE_HEIGHT_RE = /line-height\s*:\s*([^;{}]+)/gi;
const LETTER_SPACING_RE = /letter-spacing\s*:\s*([^;{}]+)/gi;
const BOX_SHADOW_RE = /box-shadow\s*:\s*([^;{}]+)/gi;
const BORDER_RADIUS_RE =
	/border(?:-top-left|-top-right|-bottom-left|-bottom-right)?-radius\s*:\s*([^;{}]+)/gi;
const CSS_VAR_RE = /--([a-zA-Z0-9_-]+)\s*:\s*([^;{}]+)/g;
const MEDIA_QUERY_RE = /@media[^{]*\bwidth\s*:\s*([\d.]+(?:px|em|rem))/gi;
const Z_INDEX_RE = /z-index\s*:\s*(-?\d+)/gi;
const SPACING_RE =
	/(?:^|[\s{;])(?:margin|padding|gap|row-gap|column-gap)\s*:\s*([^;{}]+)/gi;

function unique<T>(arr: T[]): T[] {
	return [...new Set(arr)];
}

function cleanValue(v: string): string {
	return v.trim().replace(/\s+/g, ' ').replace(/!important/gi, '').trim();
}

function extractSpacingValues(raw: string): string[] {
	const values: string[] = [];
	const parts = raw.split(/\s+/);
	for (const p of parts) {
		const clean = p.trim();
		if (/^-?[\d.]+(?:px|rem|em|vh|vw|%)$/.test(clean)) {
			values.push(clean);
		}
	}
	return values;
}

function dedupColors(colors: string[]): string[] {
	const seen = new Map<string, number>();
	for (const c of colors) {
		seen.set(c, (seen.get(c) ?? 0) + 1);
	}
	return [...seen.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([c]) => c)
		.filter(
			(c) =>
				c !== '#000000' &&
				c !== '#ffffff' &&
				c !== '#000' &&
				c !== '#fff',
		)
		.slice(0, 32);
}

function extractFontFamilies(css: string): string[] {
	const families: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(FONT_FAMILY_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const raw = (m[1] ?? '').trim();
		const first = raw.split(',')[0];
		if (!first) continue;
		const cleaned = first.replace(/["']/g, '').trim();
		if (
			cleaned &&
			!cleaned.startsWith('var(') &&
			!['inherit', 'initial', 'unset'].includes(cleaned.toLowerCase())
		) {
			families.push(cleaned);
		}
	}
	return unique(families).slice(0, 10);
}

function extractFontSizes(css: string): string[] {
	const sizes: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(FONT_SIZE_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const v = cleanValue(m[1] ?? '');
		if (
			v &&
			!v.startsWith('var(') &&
			/[\d.]/.test(v) &&
			!['inherit', 'initial', 'unset', 'larger', 'smaller'].includes(
				v.toLowerCase(),
			)
		) {
			sizes.push(v);
		}
	}
	return unique(sizes).slice(0, 20);
}

function extractFontWeights(css: string): string[] {
	const weights: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(FONT_WEIGHT_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const v = cleanValue(m[1] ?? '');
		if (
			v &&
			!v.startsWith('var(') &&
			!['inherit', 'initial', 'unset'].includes(v.toLowerCase())
		) {
			weights.push(v);
		}
	}
	return unique(weights);
}

function extractLineHeights(css: string): string[] {
	const lhs: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(LINE_HEIGHT_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const v = cleanValue(m[1] ?? '');
		if (
			v &&
			!v.startsWith('var(') &&
			!['inherit', 'initial', 'unset', 'normal'].includes(v.toLowerCase())
		) {
			lhs.push(v);
		}
	}
	return unique(lhs).slice(0, 10);
}

function extractLetterSpacings(css: string): string[] {
	const ls: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(LETTER_SPACING_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const v = cleanValue(m[1] ?? '');
		if (
			v &&
			!v.startsWith('var(') &&
			!['inherit', 'initial', 'unset', 'normal'].includes(v.toLowerCase())
		) {
			ls.push(v);
		}
	}
	return unique(ls).slice(0, 10);
}

function extractShadows(css: string): string[] {
	const shadows: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(BOX_SHADOW_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const v = cleanValue(m[1] ?? '');
		if (v && v !== 'none' && !v.startsWith('var(')) {
			shadows.push(v);
		}
	}
	return unique(shadows).slice(0, 10);
}

function extractBorderRadius(css: string): string[] {
	const radii: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(BORDER_RADIUS_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const v = cleanValue(m[1] ?? '');
		if (
			v &&
			!v.startsWith('var(') &&
			v !== '0' &&
			v !== 'inherit' &&
			v !== 'initial'
		) {
			radii.push(v);
		}
	}
	return unique(radii).slice(0, 10);
}

function extractCssVars(css: string): Record<string, string> {
	const vars: Record<string, string> = {};
	let m: RegExpExecArray | null;
	const re = new RegExp(CSS_VAR_RE.source, 'g');
	while ((m = re.exec(css)) !== null) {
		const name = (m[1] ?? '').trim();
		const value = cleanValue(m[2] ?? '');
		if (name && value) {
			vars[`--${name}`] = value;
		}
	}
	return vars;
}

function extractBreakpoints(css: string): string[] {
	const bps: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(MEDIA_QUERY_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const v = (m[1] ?? '').trim();
		if (v) bps.push(v);
	}
	return unique(bps).sort((a, b) => parseFloat(a) - parseFloat(b));
}

function extractZIndexes(css: string): string[] {
	const zis: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(Z_INDEX_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const v = (m[1] ?? '').trim();
		if (v && v !== 'auto') zis.push(v);
	}
	return unique(zis).sort((a, b) => Number(a) - Number(b));
}

function extractSpacing(css: string): string[] {
	const spacing: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(SPACING_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const values = extractSpacingValues(m[1] ?? '');
		spacing.push(...values);
	}
	return unique(spacing)
		.filter((v) => v !== '0' && v !== '0px' && !v.startsWith('-'))
		.sort((a, b) => parseFloat(a) - parseFloat(b))
		.slice(0, 30);
}

function extractColors(css: string): string[] {
	const raw: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(COLOR_RE.source, 'gi');
	while ((m = re.exec(css)) !== null) {
		const hex = normaliseToHex(m[0]);
		if (hex) raw.push(hex);
	}
	return dedupColors(raw);
}

export function parseCss(
	css: string,
	baseUrl: string,
	domain: string,
): DesignTokens {
	return {
		url: baseUrl,
		domain,
		colors: {
			all: extractColors(css),
		},
		typography: {
			fontFamilies: extractFontFamilies(css),
			fontSizes: extractFontSizes(css),
			fontWeights: extractFontWeights(css),
			lineHeights: extractLineHeights(css),
			letterSpacings: extractLetterSpacings(css),
		},
		spacing: extractSpacing(css),
		borderRadius: extractBorderRadius(css),
		shadows: extractShadows(css),
		breakpoints: extractBreakpoints(css),
		zIndexes: extractZIndexes(css),
		customProperties: extractCssVars(css),
	};
}
