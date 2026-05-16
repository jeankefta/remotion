import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {grade} from '../grader';
import {writeFile} from '../output';
import type {GradeResult} from '../types';

function cell(score: number, width = 4): string {
	const s = String(score).padStart(width);
	if (score >= 85) return chalk.green(s);
	if (score >= 70) return chalk.yellow(s);
	return chalk.red(s);
}

function gradeChip(g: string): string {
	if (g.startsWith('A')) return chalk.green.bold(g.padStart(2));
	if (g.startsWith('B')) return chalk.blue.bold(g.padStart(2));
	if (g.startsWith('C')) return chalk.yellow.bold(g.padStart(2));
	return chalk.red.bold(g.padStart(2));
}

function winner(results: GradeResult[], key: keyof GradeResult['scores']): string {
	let best = -1;
	let bestDomain = '';
	for (const r of results) {
		if (r.scores[key] > best) {
			best = r.scores[key];
			bestDomain = r.domain;
		}
	}
	return bestDomain;
}

function buildMatrix(results: GradeResult[]): string {
	const COLS = [
		{label: 'Color', key: 'colorHarmony' as const},
		{label: 'Typo', key: 'typographyConsistency' as const},
		{label: 'Spacing', key: 'spacingScale' as const},
		{label: 'A11y', key: 'accessibility' as const},
	];

	const winners = {
		colorHarmony: winner(results, 'colorHarmony'),
		typographyConsistency: winner(results, 'typographyConsistency'),
		spacingScale: winner(results, 'spacingScale'),
		accessibility: winner(results, 'accessibility'),
		overall: results.reduce((best, r) => r.overall > best.overall ? r : best, results[0]!).domain,
	};

	const domainW = Math.max(...results.map((r) => r.domain.length), 16) + 2;
	const SEP = '  ';

	const header =
		chalk.bold('Domain'.padEnd(domainW)) +
		SEP +
		COLS.map((c) => chalk.bold(c.label.padStart(7))).join(SEP) +
		SEP +
		chalk.bold('Overall'.padStart(7)) +
		SEP +
		chalk.bold('Grade');

	const divider = '─'.repeat(domainW + (7 + SEP.length) * (COLS.length + 1) + 8);

	const rows = [...results]
		.sort((a, b) => b.overall - a.overall)
		.map((r) => {
			const trophy = r.domain === winners.overall ? ' 🏆' : '   ';
			return (
				r.domain.padEnd(domainW) +
				SEP +
				COLS.map((c) => {
					const isWinner = winners[c.key] === r.domain;
					const s = cell(r.scores[c.key], 5);
					return (isWinner ? chalk.underline(s) : s).padStart(7);
				}).join(SEP) +
				SEP +
				cell(r.overall, 5).padStart(7) +
				SEP +
				gradeChip(r.grade) +
				trophy
			);
		});

	return [header, divider, ...rows].join('\n');
}

export async function runBrands(urls: string[]): Promise<void> {
	if (urls.length < 2) {
		throw new Error('Usage: designlang brands <url1> <url2> [url3 …]');
	}

	console.log(chalk.cyan(`Analysing ${urls.length} brands…\n`));

	const results: GradeResult[] = [];

	await Promise.all(
		urls.map(async (url) => {
			process.stdout.write(chalk.dim(`  Fetching ${url}… `));
			try {
				const design = await fetchDesign(url);
				const tokens = parseCss(design.css, design.baseUrl, design.domain);
				const result = grade(tokens);
				results.push(result);
				console.log(chalk.green(`${result.grade} (${result.overall})`));
			} catch (err) {
				console.log(
					chalk.red('error: ' + (err instanceof Error ? err.message : String(err))),
				);
			}
		}),
	);

	if (results.length === 0) {
		throw new Error('No brands could be fetched');
	}

	console.log(`\n${chalk.bold('Brand Matrix')}\n`);
	console.log(buildMatrix(results));
	console.log('');
	console.log(
		chalk.dim(
			'Underlined scores = category winner · 🏆 = overall winner',
		),
	);

	// Write report
	const outPath = 'designlang-brands.json';
	writeFile(
		path.join(outPath),
		JSON.stringify(
			{
				analysedAt: new Date().toISOString(),
				brands: results.sort((a, b) => b.overall - a.overall),
			},
			null,
			2,
		),
	);
	console.log(chalk.dim(`\n  Report saved: ./${outPath}`));
}
