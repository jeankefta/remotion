import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {grade} from '../grader';
import {generateBadgeSvg} from '../badge';
import {writeFile} from '../output';

function bar(score: number, width = 20): string {
	const filled = Math.round((score / 100) * width);
	const empty = width - filled;
	return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

function gradeColor(g: string): chalk.Chalk {
	if (g.startsWith('A')) return chalk.green;
	if (g.startsWith('B')) return chalk.blue;
	if (g.startsWith('C')) return chalk.yellow;
	return chalk.red;
}

export async function runGrade(
	targetUrl: string,
	withBadge: boolean,
): Promise<void> {
	console.log(chalk.cyan(`Fetching ${targetUrl}…`));
	const design = await fetchDesign(targetUrl);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);
	const result = grade(tokens);

	const gc = gradeColor(result.grade);
	console.log(`\n${chalk.bold('Design Report Card')} — ${result.domain}\n`);
	console.log(
		`  Grade: ${gc.bold(result.grade)}  ${chalk.dim(`(${result.overall}/100)`)}\n`,
	);

	const categories = [
		['Color Harmony', result.scores.colorHarmony, result.comments['colorHarmony']],
		['Typography', result.scores.typographyConsistency, result.comments['typographyConsistency']],
		['Spacing Scale', result.scores.spacingScale, result.comments['spacingScale']],
		['Accessibility', result.scores.accessibility, result.comments['accessibility']],
	] as const;

	for (const [label, score, comment] of categories) {
		console.log(
			`  ${label.padEnd(18)} ${bar(score)} ${String(score).padStart(3)}/100`,
		);
		console.log(`  ${chalk.dim(' '.repeat(18) + ' ' + (comment ?? ''))}\n`);
	}

	if (withBadge) {
		const svg = generateBadgeSvg(result);
		const outDir = `designlang-${result.domain}`;
		const badgePath = path.join(outDir, 'design-score.svg');
		writeFile(badgePath, svg);
		writeFile(
			path.join(outDir, 'grade.json'),
			JSON.stringify(result, null, 2),
		);
		console.log(chalk.bold(`📛 Badge saved: ./${badgePath}`));
		console.log(
			chalk.dim(
				'  Embed with: <img src="./designlang-' +
					result.domain +
					'/design-score.svg">',
			),
		);
	}
}
