import {contrastRatio, hexToRgb, isDark, rgbToHsl} from './colors';
import type {DesignTokens, GradeResult} from './types';

function scoreColorHarmony(tokens: DesignTokens): {
	score: number;
	comment: string;
} {
	const colors = tokens.colors.all.slice(0, 16);
	if (colors.length === 0) {
		return {score: 50, comment: 'No colors detected'};
	}

	const hues: number[] = [];
	for (const c of colors) {
		const rgb = hexToRgb(c);
		if (!rgb) continue;
		const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
		if (hsl.s > 10) hues.push(hsl.h);
	}

	if (hues.length < 2) {
		return {score: 70, comment: 'Mostly neutral/monochromatic palette'};
	}

	const hueCount = new Set(hues.map((h) => Math.round(h / 30))).size;
	// Ideal: 2-4 distinct hue families
	let score: number;
	let comment: string;
	if (hueCount <= 1) {
		score = 85;
		comment = 'Monochromatic — cohesive but limited';
	} else if (hueCount <= 3) {
		score = 92;
		comment = 'Harmonious colour family';
	} else if (hueCount <= 5) {
		score = 75;
		comment = 'Diverse palette — watch for conflicts';
	} else {
		score = 55;
		comment = `Too many hue families (${hueCount}) — lacks cohesion`;
	}

	const colorCount = colors.length;
	if (colorCount > 20) {
		score = Math.max(score - 10, 30);
		comment += '; very large palette';
	}

	return {score, comment};
}

function scoreTypographyConsistency(tokens: DesignTokens): {
	score: number;
	comment: string;
} {
	const {fontFamilies, fontSizes} = tokens.typography;
	let score = 100;
	const issues: string[] = [];

	if (fontFamilies.length > 3) {
		score -= (fontFamilies.length - 3) * 10;
		issues.push(`${fontFamilies.length} font families (ideal ≤ 2)`);
	} else if (fontFamilies.length === 0) {
		score -= 20;
		issues.push('No explicit font families declared');
	}

	if (fontSizes.length > 12) {
		score -= (fontSizes.length - 12) * 3;
		issues.push(`${fontSizes.length} font-size values`);
	}

	const comment =
		issues.length > 0 ? issues.join('; ') : 'Clean typography scale';
	return {score: Math.max(score, 20), comment};
}

function scoreSpacingScale(tokens: DesignTokens): {
	score: number;
	comment: string;
} {
	const {spacing} = tokens;
	if (spacing.length === 0) {
		return {score: 50, comment: 'No explicit spacing values detected'};
	}

	const pxValues = spacing
		.filter((s) => s.endsWith('px'))
		.map((s) => parseFloat(s))
		.filter((n) => !isNaN(n) && n > 0)
		.sort((a, b) => a - b);

	if (pxValues.length < 3) {
		return {score: 60, comment: 'Sparse spacing values'};
	}

	// Check if values follow a ratio (4px grid or 8px grid)
	const remValues = spacing
		.filter((s) => s.endsWith('rem'))
		.map((s) => parseFloat(s));

	let score = 70;
	const issues: string[] = [];

	const gridAligned4 = pxValues.filter((v) => v % 4 === 0).length;
	const gridAligned8 = pxValues.filter((v) => v % 8 === 0).length;
	const totalPx = pxValues.length;

	if (remValues.length > pxValues.length) {
		score += 15;
		issues.push('Uses rem (good for accessibility)');
	}

	const ratio4 = totalPx > 0 ? gridAligned4 / totalPx : 0;
	const ratio8 = totalPx > 0 ? gridAligned8 / totalPx : 0;

	if (ratio8 > 0.7) {
		score += 20;
		issues.push('Strong 8px grid alignment');
	} else if (ratio4 > 0.7) {
		score += 10;
		issues.push('4px grid alignment');
	} else if (ratio4 < 0.4 && totalPx > 5) {
		score -= 15;
		issues.push('Irregular spacing — no clear grid');
	}

	if (spacing.length > 25) {
		score -= 10;
		issues.push(`${spacing.length} unique spacing values (high)`);
	}

	const comment = issues.join('; ') || 'Moderate spacing consistency';
	return {score: Math.max(20, Math.min(100, score)), comment};
}

function scoreAccessibility(tokens: DesignTokens): {
	score: number;
	comment: string;
} {
	const colors = tokens.colors.all.slice(0, 12);
	if (colors.length < 2) {
		return {score: 50, comment: 'Insufficient colours to evaluate contrast'};
	}

	// Separate light vs dark colours
	const darks = colors.filter((c) => isDark(c));
	const lights = colors.filter((c) => !isDark(c));

	if (darks.length === 0 || lights.length === 0) {
		return {score: 70, comment: 'Mostly one-toned palette'};
	}

	let passing = 0;
	let total = 0;
	for (const d of darks.slice(0, 4)) {
		for (const l of lights.slice(0, 4)) {
			const ratio = contrastRatio(d, l);
			total++;
			if (ratio >= 4.5) passing++;
		}
	}

	const passRate = total > 0 ? passing / total : 0;
	let score = Math.round(passRate * 100);
	let comment: string;
	if (passRate >= 0.8) {
		comment = 'Excellent contrast ratios';
	} else if (passRate >= 0.5) {
		comment = 'Adequate contrast — some combinations may fail WCAG AA';
	} else {
		comment = 'Poor contrast — likely WCAG AA failures';
	}

	return {score: Math.max(20, score), comment};
}

function letterGrade(score: number): string {
	if (score >= 93) return 'A+';
	if (score >= 90) return 'A';
	if (score >= 87) return 'A-';
	if (score >= 83) return 'B+';
	if (score >= 80) return 'B';
	if (score >= 77) return 'B-';
	if (score >= 73) return 'C+';
	if (score >= 70) return 'C';
	if (score >= 67) return 'C-';
	if (score >= 60) return 'D';
	return 'F';
}

export function grade(tokens: DesignTokens): GradeResult {
	const colorResult = scoreColorHarmony(tokens);
	const typoResult = scoreTypographyConsistency(tokens);
	const spacingResult = scoreSpacingScale(tokens);
	const a11yResult = scoreAccessibility(tokens);

	const overall = Math.round(
		colorResult.score * 0.3 +
			typoResult.score * 0.25 +
			spacingResult.score * 0.25 +
			a11yResult.score * 0.2,
	);

	return {
		url: tokens.url,
		domain: tokens.domain,
		scores: {
			colorHarmony: colorResult.score,
			typographyConsistency: typoResult.score,
			spacingScale: spacingResult.score,
			accessibility: a11yResult.score,
		},
		overall,
		grade: letterGrade(overall),
		comments: {
			colorHarmony: colorResult.comment,
			typographyConsistency: typoResult.comment,
			spacingScale: spacingResult.comment,
			accessibility: a11yResult.comment,
		},
	};
}
