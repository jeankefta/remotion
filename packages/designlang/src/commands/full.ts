import chalk from 'chalk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {grade} from '../grader';
import {tokensToJson, tokensToCssVars, writeFile} from '../output';

const VIEWPORTS = [
	{name: 'mobile', width: 375, height: 812},
	{name: 'tablet', width: 768, height: 1024},
	{name: 'desktop', width: 1440, height: 900},
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlaywrightModule = any;

function loadPlaywright(): PlaywrightModule | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require('playwright');
	} catch {
		return null;
	}
}

async function takeScreenshots(
	targetUrl: string,
	outDir: string,
): Promise<string[]> {
	const pw = loadPlaywright();
	if (!pw) return [];
	try {
		const browser = await pw.chromium.launch({args: ['--no-sandbox']});
		const captured: string[] = [];

		for (const vp of VIEWPORTS) {
			const page = await browser.newPage({
				viewport: {width: vp.width, height: vp.height},
			});
			await page.goto(targetUrl, {waitUntil: 'networkidle', timeout: 20000});
			const screenshotPath = path.join(outDir, 'screenshots', `${vp.name}.png`);
			fs.mkdirSync(path.dirname(screenshotPath), {recursive: true});
			await page.screenshot({path: screenshotPath, fullPage: false});
			await page.close();
			captured.push(screenshotPath);
			process.stdout.write(chalk.green(` ${vp.name}`));
		}

		await browser.close();
		return captured;
	} catch {
		return [];
	}
}

async function analyzeInteractions(targetUrl: string): Promise<string[]> {
	const interactions: string[] = [];
	const pw = loadPlaywright();
	if (!pw) {
		return ['Playwright not available — install with: npx playwright install chromium'];
	}
	try {
		const browser = await pw.chromium.launch({args: ['--no-sandbox']});
		const page = await browser.newPage({
			viewport: {width: 1440, height: 900},
		});

		await page.goto(targetUrl, {waitUntil: 'networkidle', timeout: 20000});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const buttons: string[] = await page.$$eval('button, a, [role="button"]', (els: any[]) =>
			els.slice(0, 5).map((el: any) => el.textContent?.trim() ?? '').filter(Boolean),
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const inputs: string[] = await page.$$eval('input, textarea, select', (els: any[]) =>
			els.slice(0, 5).map((el: any) => el.placeholder ?? el.tagName),
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const navLinks: string[] = await page.$$eval('nav a', (els: any[]) =>
			els.slice(0, 8).map((el: any) => el.textContent?.trim() ?? '').filter(Boolean),
		);

		if (buttons.length > 0) interactions.push(`Buttons: ${buttons.join(', ')}`);
		if (inputs.length > 0) interactions.push(`Form inputs: ${inputs.join(', ')}`);
		if (navLinks.length > 0) interactions.push(`Navigation: ${navLinks.join(', ')}`);

		await browser.close();
	} catch {
		interactions.push(
			'Playwright not available — install with: npx playwright install chromium',
		);
	}
	return interactions;
}

export async function runFull(targetUrl: string): Promise<void> {
	console.log(chalk.cyan(`\nFull analysis of ${targetUrl}`));
	console.log(chalk.dim('─'.repeat(50)));

	console.log(chalk.cyan('\n[1/4] Fetching HTML + CSS…'));
	const design = await fetchDesign(targetUrl);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);
	const gradeResult = grade(tokens);
	const outDir = `designlang-full-${tokens.domain}`;

	console.log(chalk.cyan('\n[2/4] Taking screenshots across viewports…'));
	process.stdout.write(chalk.dim('  '));
	const screenshots = await takeScreenshots(targetUrl, outDir);
	if (screenshots.length === 0) {
		console.log(chalk.yellow('\n  ⚠ playwright not available — skipping screenshots'));
		console.log(chalk.dim('    Install: npx playwright install chromium'));
	} else {
		console.log(chalk.green(`\n  ${screenshots.length} screenshots captured`));
	}

	console.log(chalk.cyan('\n[3/4] Analysing interactions…'));
	const interactions = await analyzeInteractions(targetUrl);
	for (const i of interactions) {
		console.log(chalk.dim(`  ${i}`));
	}

	console.log(chalk.cyan('\n[4/4] Writing output…'));
	const report = {
		url: targetUrl,
		domain: tokens.domain,
		analysedAt: new Date().toISOString(),
		grade: gradeResult,
		tokens: {
			colorCount: tokens.colors.all.length,
			fontFamilies: tokens.typography.fontFamilies,
			spacingCount: tokens.spacing.length,
			customPropertyCount: Object.keys(tokens.customProperties).length,
			breakpoints: tokens.breakpoints,
		},
		screenshots: screenshots.map((s) => path.relative(outDir, s)),
		interactions,
	};

	writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
	writeFile(path.join(outDir, 'tokens.json'), tokensToJson(tokens));
	writeFile(path.join(outDir, 'tokens.css'), tokensToCssVars(tokens));

	console.log(chalk.green(`\n✓ Full analysis complete — ${tokens.domain}`));
	console.log(`  Grade: ${chalk.bold(gradeResult.grade)} (${gradeResult.overall}/100)`);
	console.log(chalk.bold(`\n📊 Output: ./${outDir}/`));
}
