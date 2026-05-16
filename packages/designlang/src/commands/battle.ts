import chalk from 'chalk';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {grade} from '../grader';
import type {GradeResult} from '../types';

function bar(score: number, width = 12): string {
	const filled = Math.round((score / 100) * width);
	return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function winner(a: number, b: number): string {
	if (a > b + 3) return chalk.green('◀');
	if (b > a + 3) return chalk.green('▶');
	return chalk.yellow('=');
}

function printRow(
	label: string,
	a: number,
	b: number,
	aName: string,
	bName: string,
): void {
	const w = winner(a, b);
	const aBar =
		a > b ? chalk.green(bar(a)) : chalk.dim(bar(a));
	const bBar =
		b > a ? chalk.green(bar(b)) : chalk.dim(bar(b));
	console.log(
		`  ${label.padEnd(18)} ${aBar} ${String(a).padStart(3)}  ${w}  ${String(b).padStart(3)} ${bBar}`,
	);
	void aName;
	void bName;
}

export async function runBattle(urlA: string, urlB: string): Promise<void> {
	console.log(chalk.cyan(`Fetching ${urlA}…`));
	const designA = await fetchDesign(urlA);
	console.log(chalk.cyan(`Fetching ${urlB}…`));
	const designB = await fetchDesign(urlB);

	const tokensA = parseCss(designA.css, designA.baseUrl, designA.domain);
	const tokensB = parseCss(designB.css, designB.baseUrl, designB.domain);

	const resultA: GradeResult = grade(tokensA);
	const resultB: GradeResult = grade(tokensB);

	const nameA = resultA.domain.padEnd(18).slice(0, 18);
	const nameB = resultB.domain.padEnd(18).slice(0, 18);

	console.log(`\n${chalk.bold('Design Battle')}\n`);
	console.log(
		`  ${''.padEnd(18)} ${chalk.bold(nameA)}         ${chalk.bold(nameB)}`,
	);
	console.log('  ' + '─'.repeat(62));

	printRow(
		'Color Harmony',
		resultA.scores.colorHarmony,
		resultB.scores.colorHarmony,
		resultA.domain,
		resultB.domain,
	);
	printRow(
		'Typography',
		resultA.scores.typographyConsistency,
		resultB.scores.typographyConsistency,
		resultA.domain,
		resultB.domain,
	);
	printRow(
		'Spacing Scale',
		resultA.scores.spacingScale,
		resultB.scores.spacingScale,
		resultA.domain,
		resultB.domain,
	);
	printRow(
		'Accessibility',
		resultA.scores.accessibility,
		resultB.scores.accessibility,
		resultA.domain,
		resultB.domain,
	);
	console.log('  ' + '─'.repeat(62));
	printRow(
		'OVERALL',
		resultA.overall,
		resultB.overall,
		resultA.domain,
		resultB.domain,
	);

	const winA = chalk.green.bold(resultA.grade);
	const winB = chalk.green.bold(resultB.grade);
	console.log(
		`\n  ${resultA.domain}: ${winA}   ${resultB.domain}: ${winB}`,
	);

	if (resultA.overall > resultB.overall + 3) {
		console.log(
			chalk.green.bold(
				`\n  🏆 ${resultA.domain} wins by ${resultA.overall - resultB.overall} points`,
			),
		);
	} else if (resultB.overall > resultA.overall + 3) {
		console.log(
			chalk.green.bold(
				`\n  🏆 ${resultB.domain} wins by ${resultB.overall - resultA.overall} points`,
			),
		);
	} else {
		console.log(chalk.yellow.bold('\n  🤝 Too close to call — it\'s a tie'));
	}
}
