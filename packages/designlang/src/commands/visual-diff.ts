import chalk from 'chalk';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {grade} from '../grader';
import {writeFile} from '../output';
import type {DesignTokens, GradeResult} from '../types';

function escHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colorSwatches(colors: string[]): string {
	return colors
		.slice(0, 16)
		.map(
			(c) =>
				`<span class="swatch" style="background:${escHtml(c)}" title="${escHtml(c)}"></span>`,
		)
		.join('');
}

function gradeClass(g: string): string {
	if (g.startsWith('A')) return 'grade-a';
	if (g.startsWith('B')) return 'grade-b';
	if (g.startsWith('C')) return 'grade-c';
	return 'grade-d';
}

function scoreBar(score: number): string {
	return `<div class="bar-wrap"><div class="bar-fill" style="width:${score}%;background:${score >= 85 ? '#2da44e' : score >= 70 ? '#bf8700' : '#d4262c'}"></div><span class="bar-label">${score}</span></div>`;
}

function propTable(props: Record<string, string>): string {
	const entries = Object.entries(props).slice(0, 30);
	if (entries.length === 0) return '<em>none</em>';
	return (
		'<table class="props">' +
		entries
			.map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v.slice(0, 60))}</td></tr>`)
			.join('') +
		'</table>'
	);
}

function diffProps(
	a: Record<string, string>,
	b: Record<string, string>,
): Array<{key: string; valA: string | null; valB: string | null; kind: 'added' | 'removed' | 'changed' | 'same'}> {
	const allKeys = new Set([...Object.keys(a).slice(0, 40), ...Object.keys(b).slice(0, 40)]);
	return [...allKeys].map((k) => {
		const va = a[k] ?? null;
		const vb = b[k] ?? null;
		const kind: 'added' | 'removed' | 'same' | 'changed' = va === null ? 'added' : vb === null ? 'removed' : va === vb ? 'same' : 'changed';
		return {key: k, valA: va, valB: vb, kind};
	}).filter((r) => r.kind !== 'same').slice(0, 30);
}

function buildHtml(
	tokensA: DesignTokens,
	tokensB: DesignTokens,
	gradeA: GradeResult,
	gradeB: GradeResult,
): string {
	const propDiff = diffProps(tokensA.customProperties, tokensB.customProperties);

	const diffRows = propDiff.map((r) => {
		const cls = r.kind === 'added' ? 'diff-added' : r.kind === 'removed' ? 'diff-removed' : 'diff-changed';
		const icon = r.kind === 'added' ? '+' : r.kind === 'removed' ? '-' : '~';
		return `<tr class="${escHtml(cls)}"><td>${escHtml(icon)}</td><td>${escHtml(r.key)}</td><td>${escHtml(r.valA ?? '')}</td><td>${escHtml(r.valB ?? '')}</td></tr>`;
	}).join('');

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>designlang visual-diff: ${escHtml(tokensA.domain)} vs ${escHtml(tokensB.domain)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #f6f8fa; color: #1c2128; }
header { background: #0d1117; color: #e6edf3; padding: 1.5rem 2rem; display: flex; align-items: center; gap: 1rem; }
header h1 { font-size: 1.1rem; font-weight: 600; }
header .vs { color: #484f58; }
.container { max-width: 1280px; margin: 0 auto; padding: 2rem; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.card { background: #fff; border: 1px solid #d0d7de; border-radius: 8px; padding: 1.5rem; }
.card h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: #57606a; text-transform: uppercase; letter-spacing: .05em; }
.site-name { font-size: 1.2rem; font-weight: 700; margin-bottom: .5rem; }
.grade-badge { display: inline-flex; align-items: center; justify-content: center; width: 3.5rem; height: 3.5rem; border-radius: 50%; font-size: 1.4rem; font-weight: 800; color: #fff; margin-bottom: 1rem; }
.grade-a { background: #2da44e; }
.grade-b { background: #0969da; }
.grade-c { background: #bf8700; }
.grade-d { background: #d4262c; }
.score-row { display: flex; align-items: center; gap: .75rem; margin-bottom: .5rem; font-size: .85rem; }
.score-label { width: 9rem; flex-shrink: 0; color: #57606a; }
.bar-wrap { flex: 1; background: #f6f8fa; border-radius: 4px; height: 8px; position: relative; }
.bar-fill { height: 100%; border-radius: 4px; }
.bar-label { position: absolute; right: -2.5rem; top: -5px; font-size: .75rem; color: #57606a; }
.swatches { display: flex; flex-wrap: wrap; gap: 4px; margin-top: .5rem; }
.swatch { width: 28px; height: 28px; border-radius: 4px; border: 1px solid rgba(0,0,0,.08); cursor: pointer; }
.fonts { font-size: .9rem; line-height: 2; }
.font-demo { display: block; padding: .25rem 0; border-bottom: 1px solid #f0f0f0; }
table.props { width: 100%; font-size: .75rem; border-collapse: collapse; }
table.props td { padding: .2rem .4rem; border-bottom: 1px solid #f6f8fa; word-break: break-all; }
table.props td:first-child { color: #57606a; font-family: monospace; white-space: nowrap; }
.diff-section { background: #fff; border: 1px solid #d0d7de; border-radius: 8px; padding: 1.5rem; margin-top: 1.5rem; }
.diff-section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: #57606a; text-transform: uppercase; letter-spacing: .05em; }
table.diff { width: 100%; font-size: .8rem; border-collapse: collapse; }
table.diff th { background: #f6f8fa; padding: .4rem .6rem; text-align: left; border-bottom: 2px solid #d0d7de; }
table.diff td { padding: .3rem .6rem; border-bottom: 1px solid #f6f8fa; font-family: monospace; word-break: break-all; }
.diff-added td { background: #d1f8d9; color: #1a7f37; }
.diff-removed td { background: #ffd7d5; color: #82071e; }
.diff-changed td { background: #fff8c5; color: #7d4e00; }
.section-label { font-size: .75rem; font-weight: 600; color: #57606a; text-transform: uppercase; letter-spacing: .05em; margin: 1rem 0 .5rem; }
footer { text-align: center; color: #57606a; font-size: .75rem; padding: 2rem; }
</style>
</head>
<body>
<header>
  <h1>designlang <span class="vs">visual-diff</span></h1>
  <span>${escHtml(tokensA.domain)}</span>
  <span class="vs">vs</span>
  <span>${escHtml(tokensB.domain)}</span>
  <span style="margin-left:auto;color:#484f58;font-size:.8rem">${new Date().toISOString().slice(0,10)}</span>
</header>
<div class="container">

  <!-- Grade cards -->
  <div class="grid" style="margin-bottom:1.5rem">
    ${[
			[tokensA, gradeA],
			[tokensB, gradeB],
		]
			.map(([_t, g]) => {
				const gr = g as GradeResult;
				return `<div class="card">
      <div class="site-name">${escHtml(gr.domain)}</div>
      <div class="grade-badge ${gradeClass(gr.grade)}">${escHtml(gr.grade)}</div>
      <div style="font-size:.8rem;color:#57606a;margin-bottom:1rem">${gr.overall}/100 overall</div>
      ${[
				['Color Harmony', gr.scores.colorHarmony],
				['Typography', gr.scores.typographyConsistency],
				['Spacing', gr.scores.spacingScale],
				['Accessibility', gr.scores.accessibility],
			]
				.map(([label, score]) => `<div class="score-row"><span class="score-label">${label}</span>${scoreBar(score as number)}</div>`)
				.join('')}
    </div>`;
			})
			.join('')}
  </div>

  <!-- Color palettes -->
  <div class="grid">
    ${[tokensA, tokensB]
			.map(
				(t) => `<div class="card">
      <h2>Colour Palette — ${escHtml(t.domain)}</h2>
      <div class="swatches">${colorSwatches(t.colors.all)}</div>
      <div style="font-size:.75rem;color:#57606a;margin-top:.5rem">${t.colors.all.length} colours total</div>
    </div>`,
			)
			.join('')}
  </div>

  <!-- Typography -->
  <div class="grid" style="margin-top:1.5rem">
    ${[tokensA, tokensB]
			.map(
				(t) => `<div class="card">
      <h2>Typography — ${escHtml(t.domain)}</h2>
      <div class="fonts">
        ${t.typography.fontFamilies
					.slice(0, 4)
					.map(
						(f) =>
							`<span class="font-demo" style="font-family:${escHtml(f)},sans-serif">${escHtml(f)}</span>`,
					)
					.join('')}
      </div>
      <div class="section-label" style="margin-top:1rem">Font sizes (${t.typography.fontSizes.length})</div>
      <div style="font-size:.8rem;color:#57606a">${t.typography.fontSizes.slice(0, 8).join('  ')}</div>
    </div>`,
			)
			.join('')}
  </div>

  <!-- Spacing -->
  <div class="grid" style="margin-top:1.5rem">
    ${[tokensA, tokensB]
			.map(
				(t) => `<div class="card">
      <h2>Spacing — ${escHtml(t.domain)}</h2>
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:flex-end">
        ${t.spacing
					.slice(0, 12)
					.map(
						(s) =>
							`<div title="${escHtml(s)}" style="background:#0969da;width:${Math.min(parseFloat(s) * 2, 120)}px;height:20px;border-radius:2px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px">${escHtml(s)}</div>`,
					)
					.join('')}
      </div>
    </div>`,
			)
			.join('')}
  </div>

  <!-- CSS Custom Properties diff -->
  ${
		propDiff.length > 0
			? `<div class="diff-section">
    <h2>CSS Custom Property Diff (${propDiff.length} changes)</h2>
    <table class="diff">
      <thead><tr><th></th><th>Variable</th><th>${escHtml(tokensA.domain)}</th><th>${escHtml(tokensB.domain)}</th></tr></thead>
      <tbody>${diffRows}</tbody>
    </table>
  </div>`
			: `<div class="diff-section"><h2>CSS Custom Properties</h2><p style="color:#57606a">No differences found in custom properties.</p></div>`
	}

  <!-- Raw custom props -->
  <div class="grid" style="margin-top:1.5rem">
    ${[tokensA, tokensB]
			.map(
				(t) => `<div class="card">
      <h2>Custom Properties — ${escHtml(t.domain)}</h2>
      ${propTable(t.customProperties)}
    </div>`,
			)
			.join('')}
  </div>

</div>
<footer>Generated by <strong>designlang</strong> · ${new Date().toISOString()}</footer>
</body>
</html>`;
}

export async function runVisualDiff(urlA: string, urlB: string): Promise<void> {
	console.log(chalk.cyan(`Fetching ${urlA}…`));
	const designA = await fetchDesign(urlA);
	console.log(chalk.cyan(`Fetching ${urlB}…`));
	const designB = await fetchDesign(urlB);

	const tokensA = parseCss(designA.css, designA.baseUrl, designA.domain);
	const tokensB = parseCss(designB.css, designB.baseUrl, designB.domain);

	const gradeA = grade(tokensA);
	const gradeB = grade(tokensB);

	const html = buildHtml(tokensA, tokensB, gradeA, gradeB);
	const outFile = `designlang-diff-${tokensA.domain}-vs-${tokensB.domain}.html`;
	writeFile(outFile, html);

	console.log(
		chalk.green(`\n✓ Visual diff ready: ${chalk.bold('./' + outFile)}`),
	);
	console.log(
		chalk.dim(
			`  ${tokensA.domain}: ${gradeA.grade} (${gradeA.overall})  vs  ${tokensB.domain}: ${gradeB.grade} (${gradeB.overall})`,
		),
	);
	console.log(chalk.dim('  Open in a browser to view the full diff.'));

	// Try to auto-open in browser
	try {
		const {execSync} = require('node:child_process') as typeof import('node:child_process');
		const absPath = path.resolve(outFile);
		const cmd =
			process.platform === 'darwin'
				? `open "${absPath}"`
				: process.platform === 'win32'
					? `start "" "${absPath}"`
					: `xdg-open "${absPath}" 2>/dev/null`;
		execSync(cmd, {stdio: 'ignore'});
	} catch {
		// ignore — browser open is best-effort
	}
}
