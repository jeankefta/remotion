import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {tokensToJson, tokensToCssVars, writeFile} from '../output';
import type {DesignTokens} from '../types';

function mergeDesigns(visual: DesignTokens, voice: DesignTokens): DesignTokens {
	return {
		url: `${visual.url} × ${voice.url}`,
		domain: `${visual.domain}-x-${voice.domain}`,
		colors: visual.colors,
		typography: voice.typography,
		spacing: visual.spacing,
		spacingBase: visual.spacingBase,
		borderRadius: visual.borderRadius,
		shadows: visual.shadows,
		breakpoints: voice.breakpoints.length > 0 ? voice.breakpoints : visual.breakpoints,
		breakpointChanges: voice.breakpointChanges,
		zIndexes: visual.zIndexes,
		layout: visual.layout,
		interactions: visual.interactions,
		customProperties: {
			...visual.customProperties,
			...Object.fromEntries(
				Object.entries(voice.customProperties).filter(([k]) =>
					k.includes('font') || k.includes('text') || k.includes('type'),
				),
			),
		},
	};
}

export async function runPair(urlA: string, urlB: string): Promise<void> {
	console.log(chalk.cyan(`Fetching ${urlA} (visuals)…`));
	const designA = await fetchDesign(urlA);
	console.log(chalk.cyan(`Fetching ${urlB} (voice)…`));
	const designB = await fetchDesign(urlB);

	const tokensA = parseCss(designA.css, designA.baseUrl, designA.domain);
	const tokensB = parseCss(designB.css, designB.baseUrl, designB.domain);

	const merged = mergeDesigns(tokensA, tokensB);
	const outDir = `designlang-pair-${merged.domain}`;

	writeFile(path.join(outDir, 'tokens.json'), tokensToJson(merged));
	writeFile(path.join(outDir, 'tokens.css'), tokensToCssVars(merged));

	console.log(
		chalk.green(
			`\n✓ Paired ${designA.domain} (visuals) × ${designB.domain} (voice)`,
		),
	);
	console.log(
		chalk.dim(
			`  Colors from: ${designA.domain} (${tokensA.colors.all.length} colors)`,
		),
	);
	console.log(
		chalk.dim(
			`  Fonts from:  ${designB.domain} (${tokensB.typography.fontFamilies.join(', ')})`,
		),
	);
	console.log(chalk.bold(`\n📁 Output: ./${outDir}/`));
}
