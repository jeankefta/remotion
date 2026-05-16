import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {generateBrandGuidelines} from '../ai';
import {writeFile} from '../output';

export async function runBrand(targetUrl: string): Promise<void> {
	console.log(chalk.cyan(`Fetching ${targetUrl}…`));
	const design = await fetchDesign(targetUrl);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);

	console.log(chalk.cyan('Generating 13-chapter brand guidelines via Claude…'));
	console.log(chalk.dim('  (This may take 30-60 seconds)'));

	const md = await generateBrandGuidelines(tokens);

	const outDir = `designlang-brand-${tokens.domain}`;
	writeFile(path.join(outDir, 'brand-guidelines.md'), md);
	writeFile(
		path.join(outDir, 'tokens.json'),
		JSON.stringify(tokens, null, 2),
	);

	console.log(
		chalk.green(`\n✓ Brand guidelines generated for ${tokens.domain}`),
	);
	console.log(chalk.bold(`\n📖 Output: ./${outDir}/brand-guidelines.md`));
}
