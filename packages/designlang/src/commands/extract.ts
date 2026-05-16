import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {grade} from '../grader';
import {generateBadgeSvg} from '../badge';
import {contrastRatio, isDark} from '../colors';
import {
	tokensToJson,
	tokensToCssVars,
	tokensToScss,
	tokensTailwindConfig,
	generateColorsCss,
	generateShadowsCss,
	generatePreviewHtml,
	generateDesignReadme,
	writeFile,
} from '../output';
import type {DesignTokens} from '../types';

function computeA11yPercent(tokens: DesignTokens): number {
	const darks = tokens.colors.all.filter((c) => isDark(c));
	const lights = tokens.colors.all.filter((c) => !isDark(c));
	if (darks.length === 0 || lights.length === 0) return 100;

	let passing = 0;
	let total = 0;
	for (const d of darks.slice(0, 6)) {
		for (const l of lights.slice(0, 6)) {
			const ratio = contrastRatio(d, l);
			total++;
			if (ratio >= 4.5) passing++;
		}
	}
	return total === 0 ? 100 : Math.round((passing / total) * 100);
}

function lintIssueCount(tokens: DesignTokens): number {
	let issues = 0;
	if (tokens.colors.all.length === 0) issues++;
	if (tokens.colors.all.length > 30) issues++;
	if (tokens.typography.fontFamilies.length > 3) issues++;
	if (tokens.typography.fontSizes.length > 14) issues++;
	const darks = tokens.colors.all.filter((c) => isDark(c));
	const lights = tokens.colors.all.filter((c) => !isDark(c));
	for (const d of darks.slice(0, 4)) {
		for (const l of lights.slice(0, 4)) {
			if (contrastRatio(d, l) < 4.5) {
				issues++;
				break;
			}
		}
		break;
	}
	const pxSpacing = tokens.spacing
		.filter((s) => s.endsWith('px'))
		.map((s) => parseFloat(s))
		.filter((n) => !isNaN(n) && n > 0);
	if (pxSpacing.length > 3) {
		const aligned = pxSpacing.filter((v) => v % 4 === 0).length;
		if (aligned / pxSpacing.length < 0.5) issues++;
	}
	return issues;
}

function generateLayoutJson(tokens: DesignTokens): string {
	return JSON.stringify(
		{
			domain: tokens.domain,
			grid: {
				ruleCount: tokens.layout.gridCount,
				note: 'Number of CSS rules using display:grid or display:inline-grid',
			},
			flex: {
				ruleCount: tokens.layout.flexCount,
				note: 'Number of CSS rules using display:flex or display:inline-flex',
			},
		},
		null,
		2,
	);
}

function generateInteractionsJson(tokens: DesignTokens): string {
	return JSON.stringify(
		{
			domain: tokens.domain,
			transitions: tokens.interactions.transitionCount,
			animations: tokens.interactions.animationCount,
			keyframeSets: tokens.interactions.keyframeCount,
			note: 'Counts of CSS motion/interaction declarations',
		},
		null,
		2,
	);
}

function generateResponsiveJson(tokens: DesignTokens): string {
	return JSON.stringify(
		{
			domain: tokens.domain,
			viewports: tokens.breakpoints,
			viewportCount: tokens.breakpoints.length,
			breakpointChanges: tokens.breakpointChanges,
			note: 'breakpointChanges = @media blocks that alter layout (display/grid/flex)',
		},
		null,
		2,
	);
}

function generateA11yJson(
	tokens: DesignTokens,
	a11yPercent: number,
): string {
	const darks = tokens.colors.all.filter((c) => isDark(c));
	const lights = tokens.colors.all.filter((c) => !isDark(c));
	const pairs: Array<{dark: string; light: string; ratio: number; passes: boolean}> = [];
	for (const d of darks.slice(0, 6)) {
		for (const l of lights.slice(0, 6)) {
			const ratio = Math.round(contrastRatio(d, l) * 100) / 100;
			pairs.push({dark: d, light: l, ratio, passes: ratio >= 4.5});
		}
	}
	return JSON.stringify(
		{
			domain: tokens.domain,
			wcagPassRate: a11yPercent,
			standard: 'WCAG 2.1 AA (4.5:1 minimum for normal text)',
			colorPairs: pairs.slice(0, 20),
		},
		null,
		2,
	);
}

function generateButtonsCss(tokens: DesignTokens): string {
	const primaryColor = tokens.colors.all[0] ?? '#0070f3';
	const primaryFont = tokens.typography.fontFamilies[0] ?? 'system-ui';
	const radius = tokens.borderRadius[0] ?? '4px';
	const shadow = tokens.shadows[0] ?? 'none';
	const spacing2 = tokens.spacing[1] ?? '0.5rem';
	const spacing4 = tokens.spacing[3] ?? '1rem';

	return `/* Buttons — ${tokens.domain} */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: ${spacing2} ${spacing4};
  border-radius: ${radius};
  font-family: ${JSON.stringify(primaryFont)}, system-ui, sans-serif;
  font-size: var(--font-size-1, 0.875rem);
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: opacity 0.15s ease, box-shadow 0.15s ease;
  box-shadow: ${shadow};
}

.btn-primary {
  background: ${primaryColor};
  color: #fff;
}
.btn-primary:hover { opacity: 0.85; }

.btn-secondary {
  background: transparent;
  color: ${primaryColor};
  border: 1.5px solid ${primaryColor};
}
.btn-secondary:hover { background: ${primaryColor}18; }

.btn-ghost {
  background: transparent;
  color: var(--color-1, ${primaryColor});
}
.btn-ghost:hover { background: ${primaryColor}12; }

.btn-sm { padding: 0.25rem 0.625rem; font-size: 0.75rem; }
.btn-lg { padding: 0.75rem 1.5rem; font-size: 1rem; }
.btn[disabled] { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
`;
}

function generateCardsCss(tokens: DesignTokens): string {
	const radius = tokens.borderRadius[0] ?? '8px';
	const shadow = tokens.shadows[0] ?? '0 1px 3px rgba(0,0,0,.12)';
	const spacing4 = tokens.spacing[3] ?? '1.5rem';

	return `/* Cards — ${tokens.domain} */

.card {
  background: #fff;
  border-radius: ${radius};
  box-shadow: ${shadow};
  padding: ${spacing4};
  overflow: hidden;
}

.card-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.card-title {
  font-size: var(--font-size-2, 1rem);
  font-weight: 700;
  line-height: 1.3;
}

.card-body { font-size: var(--font-size-1, 0.875rem); }

.card-footer {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-hover { transition: box-shadow 0.15s ease, transform 0.15s ease; cursor: pointer; }
.card-hover:hover { box-shadow: ${tokens.shadows[1] ?? shadow}; transform: translateY(-1px); }
`;
}

export async function runExtract(targetUrl: string): Promise<void> {
	process.stdout.write(chalk.cyan(`Fetching ${targetUrl}…`));
	const design = await fetchDesign(targetUrl);
	process.stdout.write(chalk.dim(' parsing…'));
	const tokens = parseCss(design.css, design.baseUrl, design.domain);
	const gradeResult = grade(tokens);
	const a11yPercent = computeA11yPercent(tokens);
	const issues = lintIssueCount(tokens);
	console.log('');

	const outDir = `design-extract-${tokens.domain}`;

	// 17 files
	const files: Array<[string, string]> = [
		// Tokens
		[path.join(outDir, 'tokens.json'), tokensToJson(tokens)],
		[path.join(outDir, 'tokens.css'), tokensToCssVars(tokens)],
		[path.join(outDir, 'tokens.scss'), tokensToScss(tokens)],
		[path.join(outDir, 'tailwind.config.js'), tokensTailwindConfig(tokens)],
		// Semantic CSS
		[path.join(outDir, 'colors.css'), generateColorsCss(tokens)],
		[path.join(outDir, 'shadows.css'), generateShadowsCss(tokens)],
		[path.join(outDir, 'typography.css'), generateTypographyCss(tokens)],
		// Analysis JSON
		[path.join(outDir, 'layout.json'), generateLayoutJson(tokens)],
		[path.join(outDir, 'interactions.json'), generateInteractionsJson(tokens)],
		[path.join(outDir, 'responsive.json'), generateResponsiveJson(tokens)],
		[path.join(outDir, 'a11y.json'), generateA11yJson(tokens, a11yPercent)],
		[path.join(outDir, 'grade.json'), JSON.stringify(gradeResult, null, 2)],
		// Badge
		[path.join(outDir, 'grade-badge.svg'), generateBadgeSvg(gradeResult)],
		// Components
		[path.join(outDir, 'components', 'buttons.css'), generateButtonsCss(tokens)],
		[path.join(outDir, 'components', 'cards.css'), generateCardsCss(tokens)],
		// Docs
		[path.join(outDir, 'preview.html'), generatePreviewHtml(tokens, gradeResult.grade, gradeResult.overall)],
		[path.join(outDir, 'README.md'), generateDesignReadme(tokens, gradeResult.grade, gradeResult.overall)],
	];

	for (const [filePath, content] of files) {
		writeFile(filePath, content);
	}

	// Compact 3-line stat summary
	const fontDisplay = tokens.typography.fontFamilies.slice(0, 2).join(' + ') || 'system-ui';
	const spacingDisplay =
		tokens.spacing.length +
		(tokens.spacingBase ? ` (base ${tokens.spacingBase}px)` : '');
	const gradeChip = gradeResult.grade.startsWith('A')
		? chalk.green
		: gradeResult.grade.startsWith('B')
			? chalk.blue
			: gradeResult.grade.startsWith('C')
				? chalk.yellow
				: chalk.red;

	console.log(
		chalk.bold(`Colors: `) + tokens.colors.all.length +
		chalk.dim(' · ') + chalk.bold('Fonts: ') + fontDisplay +
		chalk.dim(' · ') + chalk.bold('Spacing: ') + spacingDisplay,
	);
	console.log(
		chalk.bold('Shadows: ') + tokens.shadows.length +
		chalk.dim(' · ') + chalk.bold('Radii: ') + tokens.borderRadius.length +
		chalk.dim(' · ') + chalk.bold('CSS vars: ') + Object.keys(tokens.customProperties).length +
		chalk.dim(' · ') + chalk.bold('Layout: ') + tokens.layout.gridCount + ' grids / ' + tokens.layout.flexCount + ' flex',
	);
	console.log(
		chalk.bold('Responsive: ') + tokens.breakpoints.length + ' viewports, ' + tokens.breakpointChanges + ' breakpoint changes' +
		chalk.dim(' · ') + chalk.bold('Interactions: ') + tokens.interactions.transitionCount + ' transitions',
	);
	console.log(
		chalk.bold('A11y: ') + a11yPercent + '% WCAG' +
		chalk.dim(' · ') + chalk.bold('Score: ') + gradeChip(`${gradeResult.overall}/100 (${gradeResult.grade})`) +
		chalk.dim(' · ') + (issues > 0 ? chalk.yellow(`${issues} issue${issues > 1 ? 's' : ''}`) : chalk.green('0 issues')),
	);

	console.log('');
	console.log(chalk.dim(`→ ${files.length} files written to ./${outDir}/`));
	console.log(chalk.dim(`→ Run ${chalk.white('designlang grade ' + targetUrl)} for a shareable report card`));
}

function generateTypographyCss(tokens: DesignTokens): string {
	const primaryFont = tokens.typography.fontFamilies[0] ?? 'system-ui';
	const secondaryFont = tokens.typography.fontFamilies[1] ?? primaryFont;
	const sizes = tokens.typography.fontSizes.slice(0, 8);

	return `/* Typography — ${tokens.domain} */

body {
  font-family: ${JSON.stringify(primaryFont)}, system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}

h1, h2, h3, h4, h5, h6 {
  font-family: ${JSON.stringify(secondaryFont)}, system-ui, -apple-system, sans-serif;
  line-height: 1.2;
  font-weight: 700;
}

${sizes.map((s, i) => `.text-${i + 1} { font-size: ${s}; }`).join('\n')}

code, pre {
  font-family: ${tokens.typography.fontFamilies.find((f) => /mono|code|courier|consolas/i.test(f)) ?? 'ui-monospace'}, monospace;
}
`;
}
