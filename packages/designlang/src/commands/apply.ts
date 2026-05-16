import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {tokensToCssVars, tokensToScss, tokensTailwindConfig, writeFile} from '../output';
import type {DesignTokens} from '../types';

type Framework =
	| 'nextjs'
	| 'sveltekit'
	| 'nuxt'
	| 'astro'
	| 'vite'
	| 'remix'
	| 'gatsby'
	| 'angular'
	| 'cra'
	| 'generic';

function detectFramework(dir: string): Framework {
	const has = (f: string) => fs.existsSync(path.join(dir, f));
	const hasPkg = (dep: string): boolean => {
		try {
			const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
			const pkg = JSON.parse(raw) as {
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
			};
			return Boolean(
				pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep],
			);
		} catch {
			return false;
		}
	};

	if (has('next.config.js') || has('next.config.ts') || has('next.config.mjs'))
		return 'nextjs';
	if (has('svelte.config.js') || has('svelte.config.ts')) return 'sveltekit';
	if (has('nuxt.config.js') || has('nuxt.config.ts')) return 'nuxt';
	if (has('astro.config.mjs') || has('astro.config.ts')) return 'astro';
	if (has('remix.config.js') || has('remix.config.ts')) return 'remix';
	if (has('gatsby-config.js') || has('gatsby-config.ts')) return 'gatsby';
	if (has('angular.json')) return 'angular';
	if (hasPkg('react-scripts')) return 'cra';
	if (has('vite.config.js') || has('vite.config.ts') || has('vite.config.mjs'))
		return 'vite';
	return 'generic';
}

function hasTailwind(dir: string): boolean {
	return (
		fs.existsSync(path.join(dir, 'tailwind.config.js')) ||
		fs.existsSync(path.join(dir, 'tailwind.config.ts')) ||
		fs.existsSync(path.join(dir, 'tailwind.config.cjs'))
	);
}

function hasScss(dir: string): boolean {
	try {
		const files = fs.readdirSync(dir, {recursive: true}) as string[];
		return files.some((f) => f.endsWith('.scss') || f.endsWith('.sass'));
	} catch {
		return false;
	}
}

interface TokenDestination {
	cssPath: string | null;
	scssPath: string | null;
	tailwindPath: string | null;
}

function resolveDestinations(dir: string, fw: Framework): TokenDestination {
	const tw = hasTailwind(dir);
	const scss = hasScss(dir);
	const src = fs.existsSync(path.join(dir, 'src')) ? 'src' : '.';

	const tailwindPath = tw
		? (fs.existsSync(path.join(dir, 'tailwind.config.ts'))
				? path.join(dir, 'tailwind.config.ts')
				: path.join(dir, 'tailwind.config.js'))
		: null;

	let cssPath: string | null = null;
	let scssPath: string | null = null;

	switch (fw) {
		case 'nextjs': {
			const globalsCandidates = [
				path.join(dir, 'app', 'globals.css'),
				path.join(dir, 'styles', 'globals.css'),
				path.join(dir, 'src', 'app', 'globals.css'),
				path.join(dir, 'src', 'styles', 'globals.css'),
			];
			cssPath = globalsCandidates.find(fs.existsSync) ?? path.join(dir, 'app', 'globals.css');
			break;
		}
		case 'sveltekit':
			cssPath = fs.existsSync(path.join(dir, 'src', 'app.css'))
				? path.join(dir, 'src', 'app.css')
				: path.join(dir, 'src', 'app.css');
			break;
		case 'nuxt':
			cssPath = path.join(dir, 'assets', 'css', 'tokens.css');
			break;
		case 'astro':
			cssPath = path.join(dir, 'src', 'styles', 'tokens.css');
			break;
		case 'angular':
			cssPath = path.join(dir, 'src', 'styles.css');
			break;
		default:
			cssPath = path.join(dir, src, 'styles', 'tokens.css');
	}

	if (scss) {
		scssPath = cssPath
			? cssPath.replace(/\.css$/, '.scss').replace('tokens.scss', '_tokens.scss')
			: path.join(dir, src, 'styles', '_tokens.scss');
	}

	return {cssPath, scssPath, tailwindPath};
}

function mergeTailwindConfig(existing: string, tokens: DesignTokens): string {
	// If the file has an `extend` block, inject brand colors into it
	const colorEntries = tokens.colors.all
		.slice(0, 8)
		.map((c, i) => `        'brand-${i + 1}': '${c}',`)
		.join('\n');

	const fontEntries = tokens.typography.fontFamilies
		.slice(0, 2)
		.map((f, i) => `        '${i === 0 ? 'sans' : 'brand-' + (i + 1)}': ['${f}', 'sans-serif'],`)
		.join('\n');

	const radiusEntries = tokens.borderRadius
		.slice(0, 3)
		.map((r, i) => `        'brand-${i + 1}': '${r}',`)
		.join('\n');

	const injection = `
  // ↓ injected by designlang ↓
  theme: {
    extend: {
      colors: {
${colorEntries}
      },
      fontFamily: {
${fontEntries}
      },
      borderRadius: {
${radiusEntries}
      },
    },
  },
  // ↑ injected by designlang ↑`;

	// Try to inject before the last closing brace/bracket of module.exports / export default
	if (existing.includes('theme:') && existing.includes('extend:')) {
		// Already has extend block - add comment only
		return (
			existing.trimEnd() +
			`\n\n// designlang brand tokens: see below\n// Colors: ${tokens.colors.all.slice(0, 4).join(', ')}\n`
		);
	}

	// Insert before closing of config object
	const insertPoint = existing.lastIndexOf('}');
	if (insertPoint === -1) return existing + '\n' + injection;
	return (
		existing.slice(0, insertPoint) +
		injection +
		'\n' +
		existing.slice(insertPoint)
	);
}

function prependCssVars(existing: string, vars: string): string {
	// If :root block exists, annotate it
	if (existing.includes(':root')) {
		const comment = `\n/* ↓ designlang tokens — do not edit manually ↓ */\n${vars}\n/* ↑ designlang tokens ↑ */\n`;
		const idx = existing.indexOf(':root');
		return existing.slice(0, idx) + comment + existing.slice(idx);
	}
	return vars + '\n\n' + existing;
}

export async function runApply(
	targetUrl: string,
	dir: string,
): Promise<void> {
	const absDir = path.resolve(dir);
	if (!fs.existsSync(absDir)) {
		throw new Error(`Directory not found: ${absDir}`);
	}

	const fw = detectFramework(absDir);
	console.log(
		chalk.cyan(`Detected framework: ${chalk.bold(fw)} in ${chalk.dim(absDir)}`),
	);

	console.log(chalk.cyan(`Fetching ${targetUrl}…`));
	const design = await fetchDesign(targetUrl);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);

	const {cssPath, scssPath, tailwindPath} = resolveDestinations(absDir, fw);

	const written: string[] = [];

	if (tailwindPath) {
		const existing = fs.existsSync(tailwindPath)
			? fs.readFileSync(tailwindPath, 'utf8')
			: tokensTailwindConfig(tokens);
		const merged = fs.existsSync(tailwindPath)
			? mergeTailwindConfig(existing, tokens)
			: existing;
		writeFile(tailwindPath, merged);
		written.push(path.relative(process.cwd(), tailwindPath));
	}

	if (cssPath) {
		const cssVars = tokensToCssVars(tokens);
		if (fs.existsSync(cssPath)) {
			const existing = fs.readFileSync(cssPath, 'utf8');
			writeFile(cssPath, prependCssVars(existing, cssVars));
		} else {
			writeFile(cssPath, cssVars);
		}
		written.push(path.relative(process.cwd(), cssPath));
	}

	if (scssPath) {
		writeFile(scssPath, tokensToScss(tokens));
		written.push(path.relative(process.cwd(), scssPath));
	}

	// Always write a canonical tokens.json to the project root
	const jsonPath = path.join(absDir, 'design-tokens.json');
	writeFile(jsonPath, JSON.stringify(tokens, null, 2));
	written.push(path.relative(process.cwd(), jsonPath));

	console.log(
		chalk.green(`\n✓ Applied ${tokens.domain} design tokens to ${fw} project`),
	);
	console.log(chalk.dim(`  ${tokens.colors.all.length} colors, ${tokens.typography.fontFamilies.length} fonts, ${tokens.spacing.length} spacing values`));
	console.log('');
	for (const f of written) {
		console.log(chalk.dim(`  ✎  ${f}`));
	}
}
