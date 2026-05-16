import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {tokensToJson, tokensToCssVars, writeFile} from '../output';

export async function runExtract(targetUrl: string): Promise<void> {
	console.log(chalk.cyan(`Fetching ${targetUrl}…`));
	const design = await fetchDesign(targetUrl);
	console.log(chalk.cyan('Parsing CSS…'));
	const tokens = parseCss(design.css, design.baseUrl, design.domain);

	const outDir = `designlang-${tokens.domain}`;
	writeFile(path.join(outDir, 'tokens.json'), tokensToJson(tokens));
	writeFile(path.join(outDir, 'tokens.css'), tokensToCssVars(tokens));

	console.log(chalk.green(`\n✓ Design tokens extracted from ${tokens.domain}`));
	console.log(chalk.dim(`  ${tokens.colors.all.length} colors`));
	console.log(
		chalk.dim(
			`  ${tokens.typography.fontFamilies.length} font families: ${tokens.typography.fontFamilies.slice(0, 3).join(', ')}`,
		),
	);
	console.log(chalk.dim(`  ${tokens.spacing.length} spacing values`));
	console.log(chalk.dim(`  ${tokens.borderRadius.length} border-radius values`));
	console.log(
		chalk.dim(
			`  ${Object.keys(tokens.customProperties).length} CSS custom properties`,
		),
	);
	console.log(chalk.dim(`  ${tokens.breakpoints.length} breakpoints`));
	console.log(chalk.bold(`\n📁 Output: ./${outDir}/`));
}
