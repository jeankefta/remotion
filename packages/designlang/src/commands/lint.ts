import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {contrastRatio, hexToRgb, isDark, rgbToHsl} from '../colors';
import type {DesignTokens} from '../types';

type Severity = 'error' | 'warn' | 'info';

interface LintIssue {
	code: string;
	severity: Severity;
	message: string;
	fix?: string;
}

interface LintResult {
	file: string;
	issues: LintIssue[];
	errors: number;
	warnings: number;
	passed: boolean;
}

function issue(
	code: string,
	severity: Severity,
	message: string,
	fix?: string,
): LintIssue {
	return {code, severity, message, fix};
}

function lintColors(tokens: DesignTokens, issues: LintIssue[]): void {
	const colors = tokens.colors.all;

	if (colors.length === 0) {
		issues.push(issue('no-colors', 'error', 'No colours found in token file', 'Add a "colors.all" array with hex values'));
		return;
	}

	if (colors.length > 30) {
		issues.push(issue('too-many-colors', 'warn', `${colors.length} colours detected — consider reducing to ≤ 16`, 'Consolidate similar shades into a single palette'));
	}

	// Contrast check: dark/light pairs
	const darks = colors.filter((c) => isDark(c));
	const lights = colors.filter((c) => !isDark(c));
	let failCount = 0;
	for (const d of darks.slice(0, 6)) {
		for (const l of lights.slice(0, 6)) {
			const ratio = contrastRatio(d, l);
			if (ratio < 4.5) failCount++;
		}
	}
	if (failCount > 0 && darks.length > 0 && lights.length > 0) {
		issues.push(issue(
			'contrast-fail',
			'error',
			`${failCount} dark/light colour pairs fail WCAG AA (4.5:1 minimum contrast)`,
			'Increase lightness difference between text and background colours',
		));
	}

	// Check for near-duplicates
	const THRESHOLD = 20;
	const dupes: string[] = [];
	for (let i = 0; i < colors.length; i++) {
		for (let j = i + 1; j < colors.length; j++) {
			const rgb1 = hexToRgb(colors[i] ?? '');
			const rgb2 = hexToRgb(colors[j] ?? '');
			if (!rgb1 || !rgb2) continue;
			const dist = Math.sqrt(
				(rgb1.r - rgb2.r) ** 2 + (rgb1.g - rgb2.g) ** 2 + (rgb1.b - rgb2.b) ** 2,
			);
			if (dist < THRESHOLD) {
				dupes.push(`${colors[i]} ≈ ${colors[j]}`);
			}
		}
	}
	if (dupes.length > 0) {
		issues.push(issue(
			'near-duplicate-colors',
			'warn',
			`${dupes.length} near-duplicate colour pair(s): ${dupes.slice(0, 3).join(', ')}`,
			'Merge similar shades or use a single base + opacity variants',
		));
	}

	// Hue count warning
	const hues = new Set<number>();
	for (const c of colors) {
		const rgb = hexToRgb(c);
		if (!rgb) continue;
		const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
		if (hsl.s > 15) hues.add(Math.round(hsl.h / 30));
	}
	if (hues.size > 5) {
		issues.push(issue(
			'too-many-hues',
			'warn',
			`${hues.size} distinct hue families — palette may lack cohesion`,
			'Limit to 2–3 hue families for a coherent brand palette',
		));
	}
}

function lintTypography(tokens: DesignTokens, issues: LintIssue[]): void {
	const {fontFamilies, fontSizes} = tokens.typography;

	if (fontFamilies.length === 0) {
		issues.push(issue('no-fonts', 'warn', 'No font families declared', 'Add explicit font-family declarations'));
	} else if (fontFamilies.length > 3) {
		issues.push(issue(
			'too-many-fonts',
			'error',
			`${fontFamilies.length} font families (max recommended: 2)`,
			`Remove ${fontFamilies.length - 2} font families`,
		));
	}

	if (fontSizes.length === 0) {
		issues.push(issue('no-font-sizes', 'warn', 'No font-size values found', 'Define an explicit type scale'));
	} else if (fontSizes.length > 14) {
		issues.push(issue(
			'too-many-font-sizes',
			'warn',
			`${fontSizes.length} font-size values — consider a type scale with ≤ 8 steps`,
			'Map ad-hoc sizes to a named scale (xs, sm, base, lg, xl…)',
		));
	}
}

function lintSpacing(tokens: DesignTokens, issues: LintIssue[]): void {
	const {spacing} = tokens;

	if (spacing.length === 0) {
		issues.push(issue('no-spacing', 'info', 'No spacing values detected', 'Define explicit margin/padding/gap values'));
		return;
	}

	const pxValues = spacing
		.filter((s) => s.endsWith('px'))
		.map((s) => parseFloat(s))
		.filter((n) => !isNaN(n) && n > 0)
		.sort((a, b) => a - b);

	if (pxValues.length > 3) {
		const gridAligned = pxValues.filter((v) => v % 4 === 0).length;
		const ratio = gridAligned / pxValues.length;
		if (ratio < 0.5) {
			issues.push(issue(
				'no-spacing-grid',
				'warn',
				`Only ${Math.round(ratio * 100)}% of spacing values align to a 4px grid`,
				'Use multiples of 4px (4, 8, 12, 16, 24, 32, 48, 64) for consistent spacing',
			));
		}
	}

	if (spacing.length > 24) {
		issues.push(issue(
			'too-many-spacing-values',
			'warn',
			`${spacing.length} unique spacing values — hard to maintain consistency`,
			'Collapse to a named scale with ≤ 10 steps',
		));
	}
}

function lintCustomProperties(tokens: DesignTokens, issues: LintIssue[]): void {
	const props = tokens.customProperties;
	const names = Object.keys(props);

	if (names.length === 0) {
		issues.push(issue('no-custom-props', 'info', 'No CSS custom properties (--variables) found', 'Use CSS custom properties to centralise your design tokens'));
		return;
	}

	// Check for magic-number values (bare px numbers without a token)
	const bareNumbers = names.filter((n) => /^\d+$/.test(props[n] ?? ''));
	if (bareNumbers.length > 0) {
		issues.push(issue(
			'bare-number-vars',
			'warn',
			`${bareNumbers.length} custom properties have bare numeric values (no unit)`,
			'Add px/rem/em units to custom property values',
		));
	}
}

function lintSchema(raw: unknown, issues: LintIssue[]): raw is DesignTokens {
	if (!raw || typeof raw !== 'object') {
		issues.push(issue('invalid-schema', 'error', 'Token file must be a JSON object', ''));
		return false;
	}
	const obj = raw as Record<string, unknown>;
	if (!obj['colors'] || typeof obj['colors'] !== 'object') {
		issues.push(issue('missing-colors', 'error', 'Missing required "colors" section', 'Add a "colors": { "all": [] } block'));
	}
	if (!obj['typography'] || typeof obj['typography'] !== 'object') {
		issues.push(issue('missing-typography', 'error', 'Missing required "typography" section', 'Add a "typography": { "fontFamilies": [], ... } block'));
	}
	if (!obj['spacing'] || !Array.isArray(obj['spacing'])) {
		issues.push(issue('missing-spacing', 'warn', 'Missing "spacing" array', 'Add a "spacing": [] block'));
	}
	return issues.filter((i) => i.severity === 'error').length === 0;
}

function printIssue(iss: LintIssue): void {
	const icon = iss.severity === 'error' ? chalk.red('✖') : iss.severity === 'warn' ? chalk.yellow('⚠') : chalk.blue('ℹ');
	const code = chalk.dim(`[${iss.code}]`);
	console.log(`  ${icon} ${iss.message} ${code}`);
	if (iss.fix) console.log(`    ${chalk.dim('→')} ${chalk.dim(iss.fix)}`);
}

export async function runLint(
	tokenFile: string,
	strict: boolean,
): Promise<void> {
	const absFile = path.resolve(tokenFile);
	if (!fs.existsSync(absFile)) {
		throw new Error(`Token file not found: ${absFile}`);
	}

	let raw: unknown;
	try {
		raw = JSON.parse(fs.readFileSync(absFile, 'utf8'));
	} catch {
		throw new Error(`Invalid JSON: ${absFile}`);
	}

	const issues: LintIssue[] = [];
	const schemaOk = lintSchema(raw, issues);

	if (schemaOk) {
		const tokens = raw as DesignTokens;
		lintColors(tokens, issues);
		lintTypography(tokens, issues);
		lintSpacing(tokens, issues);
		lintCustomProperties(tokens, issues);
	}

	const errors = issues.filter((i) => i.severity === 'error').length;
	const warnings = issues.filter((i) => i.severity === 'warn').length;
	const infos = issues.filter((i) => i.severity === 'info').length;

	const result: LintResult = {
		file: absFile,
		issues,
		errors,
		warnings,
		passed: strict ? errors === 0 && warnings === 0 : errors === 0,
	};

	console.log(`\n${chalk.bold('designlang lint')} — ${path.relative(process.cwd(), absFile)}\n`);

	if (issues.length === 0) {
		console.log(chalk.green('  ✓ No issues found'));
	} else {
		const sorted = [
			...issues.filter((i) => i.severity === 'error'),
			...issues.filter((i) => i.severity === 'warn'),
			...issues.filter((i) => i.severity === 'info'),
		];
		for (const iss of sorted) printIssue(iss);
	}

	console.log('');
	const summary = [
		errors > 0 ? chalk.red(`${errors} error${errors > 1 ? 's' : ''}`) : null,
		warnings > 0 ? chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`) : null,
		infos > 0 ? chalk.blue(`${infos} info`) : null,
	]
		.filter(Boolean)
		.join('  ');

	if (result.passed) {
		console.log(chalk.green('  ✓ Lint passed') + (summary ? `  ${summary}` : ''));
	} else {
		console.log(chalk.red('  ✖ Lint failed') + (summary ? `  ${summary}` : ''));
		process.exitCode = 1;
	}

	// Machine-readable output for CI
	if (process.env['CI']) {
		const ciOut = JSON.stringify(result, null, 2);
		try {
			fs.writeFileSync('designlang-lint.json', ciOut, 'utf8');
		} catch {
			// ignore
		}
	}
}
