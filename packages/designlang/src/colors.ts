export interface RGB {
	r: number;
	g: number;
	b: number;
}

export interface HSL {
	h: number;
	s: number;
	l: number;
}

export function hexToRgb(hex: string): RGB | null {
	const clean = hex.replace('#', '');
	if (clean.length === 3) {
		const r = parseInt((clean[0] ?? '') + (clean[0] ?? ''), 16);
		const g = parseInt((clean[1] ?? '') + (clean[1] ?? ''), 16);
		const b = parseInt((clean[2] ?? '') + (clean[2] ?? ''), 16);
		return {r, g, b};
	}
	if (clean.length === 6 || clean.length === 8) {
		const r = parseInt(clean.slice(0, 2), 16);
		const g = parseInt(clean.slice(2, 4), 16);
		const b = parseInt(clean.slice(4, 6), 16);
		return {r, g, b};
	}
	return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
	return (
		'#' +
		[r, g, b]
			.map((v) =>
				Math.max(0, Math.min(255, Math.round(v)))
					.toString(16)
					.padStart(2, '0'),
			)
			.join('')
	);
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case rn:
				h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
				break;
			case gn:
				h = ((bn - rn) / d + 2) / 6;
				break;
			default:
				h = ((rn - gn) / d + 4) / 6;
		}
	}
	return {h: h * 360, s: s * 100, l: l * 100};
}

export function hslToHex(h: number, s: number, l: number): string {
	const sn = s / 100;
	const ln = l / 100;
	const a = sn * Math.min(ln, 1 - ln);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color);
	};
	return rgbToHex(f(0), f(8), f(4));
}

function parseRgbValue(str: string): RGB | null {
	const m = str.match(
		/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
	);
	if (!m) return null;
	return {
		r: parseFloat(m[1] ?? '0'),
		g: parseFloat(m[2] ?? '0'),
		b: parseFloat(m[3] ?? '0'),
	};
}

function parseHslValue(str: string): RGB | null {
	const m = str.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
	if (!m) return null;
	const h = parseFloat(m[1] ?? '0');
	const s = parseFloat(m[2] ?? '0');
	const l = parseFloat(m[3] ?? '0');
	const hex = hslToHex(h, s, l);
	return hexToRgb(hex);
}

export function normaliseToHex(colorStr: string): string | null {
	const s = colorStr.trim().toLowerCase();
	if (s.startsWith('#')) {
		const clean = s.replace('#', '');
		if (clean.length === 3) {
			return (
				'#' +
				clean
					.split('')
					.map((c) => c + c)
					.join('')
			);
		}
		if (clean.length === 6 || clean.length === 8) {
			return '#' + clean.slice(0, 6);
		}
		return null;
	}
	if (s.startsWith('rgb')) {
		const rgb = parseRgbValue(s);
		if (!rgb) return null;
		return rgbToHex(rgb.r, rgb.g, rgb.b);
	}
	if (s.startsWith('hsl')) {
		const rgb = parseHslValue(s);
		if (!rgb) return null;
		return rgbToHex(rgb.r, rgb.g, rgb.b);
	}
	// Named colors subset
	const NAMED: Record<string, string> = {
		white: '#ffffff',
		black: '#000000',
		red: '#ff0000',
		green: '#008000',
		blue: '#0000ff',
		yellow: '#ffff00',
		orange: '#ffa500',
		purple: '#800080',
		pink: '#ffc0cb',
		gray: '#808080',
		grey: '#808080',
		transparent: '#00000000',
	};
	return NAMED[s] ?? null;
}

export function relativeLuminance(hex: string): number {
	const rgb = hexToRgb(hex);
	if (!rgb) return 0;
	const linearize = (v: number) => {
		const vn = v / 255;
		return vn <= 0.03928 ? vn / 12.92 : Math.pow((vn + 0.055) / 1.055, 2.4);
	};
	return (
		0.2126 * linearize(rgb.r) +
		0.7152 * linearize(rgb.g) +
		0.0722 * linearize(rgb.b)
	);
}

export function contrastRatio(hex1: string, hex2: string): number {
	const l1 = relativeLuminance(hex1);
	const l2 = relativeLuminance(hex2);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

export function shiftHue(hex: string, degrees: number): string {
	const rgb = hexToRgb(hex);
	if (!rgb) return hex;
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
	return hslToHex((hsl.h + degrees + 360) % 360, hsl.s, hsl.l);
}

export function adjustLightness(hex: string, delta: number): string {
	const rgb = hexToRgb(hex);
	if (!rgb) return hex;
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
	return hslToHex(hsl.h, hsl.s, Math.max(0, Math.min(100, hsl.l + delta)));
}

export function adjustSaturation(hex: string, delta: number): string {
	const rgb = hexToRgb(hex);
	if (!rgb) return hex;
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
	return hslToHex(hsl.h, Math.max(0, Math.min(100, hsl.s + delta)), hsl.l);
}

export function colorDistance(hex1: string, hex2: string): number {
	const rgb1 = hexToRgb(hex1);
	const rgb2 = hexToRgb(hex2);
	if (!rgb1 || !rgb2) return Infinity;
	return Math.sqrt(
		Math.pow(rgb1.r - rgb2.r, 2) +
			Math.pow(rgb1.g - rgb2.g, 2) +
			Math.pow(rgb1.b - rgb2.b, 2),
	);
}

export function isDark(hex: string): boolean {
	return relativeLuminance(hex) < 0.5;
}

export function generatePalette(primaryHex: string): Record<string, string> {
	const rgb = hexToRgb(primaryHex);
	if (!rgb) return {};
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
	return {
		'50': hslToHex(hsl.h, Math.min(hsl.s, 30), 97),
		'100': hslToHex(hsl.h, Math.min(hsl.s, 50), 93),
		'200': hslToHex(hsl.h, Math.min(hsl.s, 60), 85),
		'300': hslToHex(hsl.h, hsl.s, 74),
		'400': hslToHex(hsl.h, hsl.s, 62),
		'500': primaryHex,
		'600': hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 8, 10)),
		'700': hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 16, 5)),
		'800': hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 26, 3)),
		'900': hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 36, 2)),
		'950': hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 44, 1)),
	};
}

export function replaceHue(sourceHex: string, targetHex: string): string {
	const sourceRgb = hexToRgb(sourceHex);
	const targetRgb = hexToRgb(targetHex);
	if (!sourceRgb || !targetRgb) return sourceHex;
	const sourceHsl = rgbToHsl(sourceRgb.r, sourceRgb.g, sourceRgb.b);
	const targetHsl = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);
	return hslToHex(targetHsl.h, sourceHsl.s, sourceHsl.l);
}
