import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {remixTokens} from '../ai';
import {writeFile} from '../output';
import type {RemixVocab} from '../types';
import {ALL_VOCABS} from '../types';

export async function runRemix(
	targetUrl: string,
	vocab: RemixVocab | null,
	all: boolean,
): Promise<void> {
	console.log(chalk.cyan(`Fetching ${targetUrl}…`));
	const design = await fetchDesign(targetUrl);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);

	const vocabs: RemixVocab[] = all ? ALL_VOCABS : vocab ? [vocab] : [];
	if (vocabs.length === 0) {
		throw new Error('Specify --as <vocab> or --all. Vocabs: ' + ALL_VOCABS.join(', '));
	}

	console.log(
		chalk.cyan(
			`Remixing in ${vocabs.length} vocabulary${vocabs.length > 1 ? 's' : ''} via Claude…`,
		),
	);

	const outDir = `designlang-remix-${tokens.domain}`;

	for (const v of vocabs) {
		process.stdout.write(chalk.dim(`  ${v}… `));
		try {
			const css = await remixTokens(tokens, v);
			writeFile(path.join(outDir, `${v}.css`), css);
			console.log(chalk.green('✓'));
		} catch (err) {
			console.log(chalk.red('✗ ' + (err instanceof Error ? err.message : String(err))));
		}
	}

	console.log(chalk.bold(`\n🎭 Output: ./${outDir}/`));
}
