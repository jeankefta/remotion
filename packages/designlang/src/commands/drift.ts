import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {colorDistance} from '../colors';
import {writeFile} from '../output';
import type {DesignTokens} from '../types';

interface DriftReport {
	url: string;
	tokensFile: string;
	analysedAt: string;
	colors: {
		added: string[];
		removed: string[];
		unchanged: number;
	};
	typography: {
		addedFamilies: string[];
		removedFamilies: string[];
		addedSizes: string[];
		removedSizes: string[];
	};
	spacing: {
		added: string[];
		removed: string[];
	};
	customProperties: {
		added: string[];
		removed: string[];
		changed: Array<{name: string; before: string; after: string}>;
	};
	summary: {
		totalChanges: number;
		severity: 'none' | 'minor' | 'moderate' | 'major';
	};
}

function findNearestColor(
	target: string,
	candidates: string[],
	threshold = 30,
): string | null {
	for (const c of candidates) {
		if (colorDistance(target, c) < threshold) return c;
	}
	return null;
}

function diffColors(
	local: string[],
	live: string[],
): {added: string[]; removed: string[]; unchanged: number} {
	const added: string[] = [];
	const removed: string[] = [];
	let unchanged = 0;

	for (const liveColor of live) {
		if (findNearestColor(liveColor, local)) {
			unchanged++;
		} else {
			added.push(liveColor);
		}
	}

	for (const localColor of local) {
		if (!findNearestColor(localColor, live)) {
			removed.push(localColor);
		}
	}

	return {added, removed, unchanged};
}

function diffArrays(
	local: string[],
	live: string[],
): {added: string[]; removed: string[]} {
	const localSet = new Set(local.map((s) => s.toLowerCase()));
	const liveSet = new Set(live.map((s) => s.toLowerCase()));
	return {
		added: live.filter((s) => !localSet.has(s.toLowerCase())),
		removed: local.filter((s) => !liveSet.has(s.toLowerCase())),
	};
}

function diffCustomProps(
	local: Record<string, string>,
	live: Record<string, string>,
): {
	added: string[];
	removed: string[];
	changed: Array<{name: string; before: string; after: string}>;
} {
	const added: string[] = [];
	const removed: string[] = [];
	const changed: Array<{name: string; before: string; after: string}> = [];

	for (const [k, v] of Object.entries(live)) {
		if (!(k in local)) {
			added.push(k);
		} else if (local[k] !== v) {
			changed.push({name: k, before: local[k] ?? '', after: v});
		}
	}

	for (const k of Object.keys(local)) {
		if (!(k in live)) {
			removed.push(k);
		}
	}

	return {added, removed, changed};
}

function severity(totalChanges: number): DriftReport['summary']['severity'] {
	if (totalChanges === 0) return 'none';
	if (totalChanges <= 5) return 'minor';
	if (totalChanges <= 15) return 'moderate';
	return 'major';
}

function severityColor(s: DriftReport['summary']['severity']): chalk.Chalk {
	if (s === 'none') return chalk.green;
	if (s === 'minor') return chalk.yellow;
	if (s === 'moderate') return chalk.yellow;
	return chalk.red;
}

export async function runDrift(
	targetUrl: string,
	tokensFile: string,
): Promise<void> {
	const absFile = path.resolve(tokensFile);
	if (!fs.existsSync(absFile)) {
		throw new Error(`Token file not found: ${absFile}`);
	}

	let local: DesignTokens;
	try {
		local = JSON.parse(fs.readFileSync(absFile, 'utf8')) as DesignTokens;
	} catch {
		throw new Error(`Could not parse token file: ${absFile}`);
	}

	console.log(chalk.cyan(`Fetching live ${targetUrl}…`));
	const design = await fetchDesign(targetUrl);
	const live = parseCss(design.css, design.baseUrl, design.domain);

	console.log(chalk.cyan('Computing drift…'));

	const colorDiff = diffColors(local.colors.all, live.colors.all);
	const fontFamilyDiff = diffArrays(
		local.typography.fontFamilies,
		live.typography.fontFamilies,
	);
	const fontSizeDiff = diffArrays(
		local.typography.fontSizes,
		live.typography.fontSizes,
	);
	const spacingDiff = diffArrays(local.spacing, live.spacing);

	// Limit custom prop diff to first 50 to avoid noise
	const localTopProps = Object.fromEntries(
		Object.entries(local.customProperties).slice(0, 50),
	);
	const liveTopProps = Object.fromEntries(
		Object.entries(live.customProperties).slice(0, 50),
	);
	const propDiff = diffCustomProps(localTopProps, liveTopProps);

	const totalChanges =
		colorDiff.added.length +
		colorDiff.removed.length +
		fontFamilyDiff.added.length +
		fontFamilyDiff.removed.length +
		spacingDiff.added.length +
		spacingDiff.removed.length +
		propDiff.changed.length;

	const report: DriftReport = {
		url: targetUrl,
		tokensFile: absFile,
		analysedAt: new Date().toISOString(),
		colors: colorDiff,
		typography: {
			addedFamilies: fontFamilyDiff.added,
			removedFamilies: fontFamilyDiff.removed,
			addedSizes: fontSizeDiff.added.slice(0, 10),
			removedSizes: fontSizeDiff.removed.slice(0, 10),
		},
		spacing: spacingDiff,
		customProperties: {
			added: propDiff.added.slice(0, 20),
			removed: propDiff.removed.slice(0, 20),
			changed: propDiff.changed.slice(0, 20),
		},
		summary: {totalChanges, severity: severity(totalChanges)},
	};

	const sev = report.summary.severity;
	const sevColor = severityColor(sev);

	console.log(`\n${chalk.bold('Drift Report')} — ${live.domain} vs ${path.basename(tokensFile)}\n`);
	console.log(
		`  Drift severity: ${sevColor.bold(sev.toUpperCase())}  (${totalChanges} changes)\n`,
	);

	function section(title: string, added: string[], removed: string[], changed?: Array<{name: string; before: string; after: string}>): void {
		if (added.length === 0 && removed.length === 0 && (!changed || changed.length === 0)) {
			console.log(`  ${chalk.bold(title)}: ${chalk.green('no changes')}`);
			return;
		}
		console.log(`  ${chalk.bold(title)}:`);
		for (const a of added.slice(0, 5)) console.log(`    ${chalk.green('+')} ${a}`);
		if (added.length > 5) console.log(`    ${chalk.dim(`+ ${added.length - 5} more…`)}`);
		for (const r of removed.slice(0, 5)) console.log(`    ${chalk.red('-')} ${r}`);
		if (removed.length > 5) console.log(`    ${chalk.dim(`- ${removed.length - 5} more…`)}`);
		if (changed) {
			for (const c of changed.slice(0, 5)) {
				console.log(`    ${chalk.yellow('~')} ${c.name}: ${chalk.dim(c.before)} → ${chalk.yellow(c.after)}`);
			}
		}
	}

	section('Colors', colorDiff.added, colorDiff.removed);
	section(
		'Font Families',
		fontFamilyDiff.added,
		fontFamilyDiff.removed,
	);
	section('Spacing', spacingDiff.added, spacingDiff.removed);
	section('CSS Variables', propDiff.added, propDiff.removed, propDiff.changed);

	const outPath = `designlang-drift-${live.domain}.json`;
	writeFile(outPath, JSON.stringify(report, null, 2));
	console.log(chalk.dim(`\n  Full report saved: ./${outPath}`));

	if (sev === 'major' || sev === 'moderate') {
		process.exitCode = 1;
	}
}
