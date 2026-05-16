import * as readline from 'node:readline';
import {fetchDesign} from '../fetcher';
import {parseCss} from '../css-parser';
import {grade} from '../grader';
import {generateBadgeSvg} from '../badge';
import {tokensToCssVars} from '../output';
import type {DesignTokens} from '../types';

// Minimal JSON-RPC 2.0 / MCP stdio implementation
// Compatible with Claude Code, Cursor, and any MCP-aware host.

const SERVER_INFO = {name: 'designlang', version: '12.9.0'};

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
	jsonrpc: '2.0';
	id?: JsonRpcId;
	method: string;
	params?: unknown;
}

interface ToolDef {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, {type: string; description: string; enum?: string[]}>;
		required?: string[];
	};
}

type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

const TOOLS: ToolDef[] = [
	{
		name: 'extract_tokens',
		description:
			'Fetch a website and extract its design tokens (colors, typography, spacing, shadows, CSS custom properties, breakpoints).',
		inputSchema: {
			type: 'object',
			properties: {
				url: {type: 'string', description: 'Website URL to extract tokens from'},
			},
			required: ['url'],
		},
	},
	{
		name: 'grade_design',
		description:
			'Grade the design quality of a website on color harmony, typography consistency, spacing scale, and WCAG accessibility. Returns a score 0–100 and letter grade.',
		inputSchema: {
			type: 'object',
			properties: {
				url: {type: 'string', description: 'Website URL to grade'},
				badge: {
					type: 'boolean',
					description: 'Whether to include the SVG badge markup in the response',
				},
			},
			required: ['url'],
		},
	},
	{
		name: 'battle_designs',
		description:
			'Compare two websites head-to-head across design quality dimensions. Returns scores and a winner.',
		inputSchema: {
			type: 'object',
			properties: {
				urlA: {type: 'string', description: 'First website URL'},
				urlB: {type: 'string', description: 'Second website URL'},
			},
			required: ['urlA', 'urlB'],
		},
	},
	{
		name: 'get_css_vars',
		description:
			'Extract a website\'s design tokens and return them as CSS custom properties (:root block).',
		inputSchema: {
			type: 'object',
			properties: {
				url: {type: 'string', description: 'Website URL'},
			},
			required: ['url'],
		},
	},
	{
		name: 'lint_tokens',
		description:
			'Lint a design token JSON object for issues: accessibility failures, duplicate colors, too many fonts, inconsistent spacing scale. Returns structured issue list.',
		inputSchema: {
			type: 'object',
			properties: {
				tokens: {
					type: 'string',
					description: 'JSON string of the design tokens object to lint',
				},
			},
			required: ['tokens'],
		},
	},
	{
		name: 'diff_designs',
		description:
			'Compare two websites and return a structured diff of their design tokens (colors added/removed, font changes, CSS variable changes).',
		inputSchema: {
			type: 'object',
			properties: {
				urlA: {type: 'string', description: 'First website URL (baseline)'},
				urlB: {type: 'string', description: 'Second website URL (comparison)'},
			},
			required: ['urlA', 'urlB'],
		},
	},
];

async function handleExtractTokens(args: Record<string, unknown>): Promise<string> {
	const url = String(args['url'] ?? '');
	const design = await fetchDesign(url);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);
	return JSON.stringify(
		{
			domain: tokens.domain,
			colors: tokens.colors.all.slice(0, 20),
			typography: tokens.typography,
			spacing: tokens.spacing.slice(0, 20),
			borderRadius: tokens.borderRadius,
			shadows: tokens.shadows,
			breakpoints: tokens.breakpoints,
			customPropertiesCount: Object.keys(tokens.customProperties).length,
			customPropertiesSample: Object.fromEntries(
				Object.entries(tokens.customProperties).slice(0, 20),
			),
		},
		null,
		2,
	);
}

async function handleGradeDesign(args: Record<string, unknown>): Promise<string> {
	const url = String(args['url'] ?? '');
	const withBadge = Boolean(args['badge']);
	const design = await fetchDesign(url);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);
	const result = grade(tokens);

	const out: Record<string, unknown> = {
		domain: result.domain,
		grade: result.grade,
		overall: result.overall,
		scores: result.scores,
		comments: result.comments,
	};

	if (withBadge) {
		out['badgeSvg'] = generateBadgeSvg(result);
	}

	return JSON.stringify(out, null, 2);
}

async function handleBattleDesigns(args: Record<string, unknown>): Promise<string> {
	const [designA, designB] = await Promise.all([
		fetchDesign(String(args['urlA'] ?? '')),
		fetchDesign(String(args['urlB'] ?? '')),
	]);
	const tokensA = parseCss(designA.css, designA.baseUrl, designA.domain);
	const tokensB = parseCss(designB.css, designB.baseUrl, designB.domain);
	const gradeA = grade(tokensA);
	const gradeB = grade(tokensB);

	const categories = ['colorHarmony', 'typographyConsistency', 'spacingScale', 'accessibility'] as const;
	const categoryWinners = Object.fromEntries(
		categories.map((k) => [
			k,
			gradeA.scores[k] >= gradeB.scores[k] ? designA.domain : designB.domain,
		]),
	);

	return JSON.stringify(
		{
			winner:
				gradeA.overall > gradeB.overall + 3
					? designA.domain
					: gradeB.overall > gradeA.overall + 3
						? designB.domain
						: 'tie',
			marginPoints: Math.abs(gradeA.overall - gradeB.overall),
			results: {
				[designA.domain]: {grade: gradeA.grade, overall: gradeA.overall, scores: gradeA.scores},
				[designB.domain]: {grade: gradeB.grade, overall: gradeB.overall, scores: gradeB.scores},
			},
			categoryWinners,
		},
		null,
		2,
	);
}

async function handleGetCssVars(args: Record<string, unknown>): Promise<string> {
	const url = String(args['url'] ?? '');
	const design = await fetchDesign(url);
	const tokens = parseCss(design.css, design.baseUrl, design.domain);
	return tokensToCssVars(tokens);
}

function lintTokensSync(tokens: DesignTokens): Array<{code: string; severity: string; message: string}> {
	const issues: Array<{code: string; severity: string; message: string}> = [];
	if (!tokens.colors?.all?.length) {
		issues.push({code: 'no-colors', severity: 'error', message: 'No colors found'});
	} else if (tokens.colors.all.length > 30) {
		issues.push({code: 'too-many-colors', severity: 'warn', message: `${tokens.colors.all.length} colors — consider reducing`});
	}
	if (!tokens.typography?.fontFamilies?.length) {
		issues.push({code: 'no-fonts', severity: 'warn', message: 'No font families declared'});
	} else if (tokens.typography.fontFamilies.length > 3) {
		issues.push({code: 'too-many-fonts', severity: 'error', message: `${tokens.typography.fontFamilies.length} font families (max 2 recommended)`});
	}
	if (!tokens.spacing?.length) {
		issues.push({code: 'no-spacing', severity: 'info', message: 'No spacing values found'});
	}
	return issues;
}

async function handleLintTokens(args: Record<string, unknown>): Promise<string> {
	let tokens: DesignTokens;
	try {
		tokens = JSON.parse(String(args['tokens'] ?? '{}')) as DesignTokens;
	} catch {
		return JSON.stringify({error: 'Invalid JSON'});
	}
	const issues = lintTokensSync(tokens);
	const errors = issues.filter((i) => i.severity === 'error').length;
	return JSON.stringify({passed: errors === 0, issueCount: issues.length, issues}, null, 2);
}

async function handleDiffDesigns(args: Record<string, unknown>): Promise<string> {
	const [designA, designB] = await Promise.all([
		fetchDesign(String(args['urlA'] ?? '')),
		fetchDesign(String(args['urlB'] ?? '')),
	]);
	const tA = parseCss(designA.css, designA.baseUrl, designA.domain);
	const tB = parseCss(designB.css, designB.baseUrl, designB.domain);

	const colorsInANotB = tA.colors.all.filter((c) => !tB.colors.all.includes(c)).slice(0, 10);
	const colorsInBNotA = tB.colors.all.filter((c) => !tA.colors.all.includes(c)).slice(0, 10);
	const fontFamsA = new Set(tA.typography.fontFamilies);
	const fontFamsB = new Set(tB.typography.fontFamilies);

	const propKeys = new Set([
		...Object.keys(tA.customProperties).slice(0, 30),
		...Object.keys(tB.customProperties).slice(0, 30),
	]);
	const changedProps: Array<{key: string; a: string; b: string}> = [];
	for (const k of propKeys) {
		const va = tA.customProperties[k];
		const vb = tB.customProperties[k];
		if (va && vb && va !== vb) changedProps.push({key: k, a: va, b: vb});
	}

	return JSON.stringify(
		{
			compared: [designA.domain, designB.domain],
			colors: {
				onlyInA: colorsInANotB,
				onlyInB: colorsInBNotA,
				sharedCount: tA.colors.all.filter((c) => tB.colors.all.includes(c)).length,
			},
			typography: {
				fontsOnlyInA: [...fontFamsA].filter((f) => !fontFamsB.has(f)),
				fontsOnlyInB: [...fontFamsB].filter((f) => !fontFamsA.has(f)),
			},
			customProperties: {
				changed: changedProps.slice(0, 20),
				onlyInA: Object.keys(tA.customProperties).filter(
					(k) => !(k in tB.customProperties),
				).length,
				onlyInB: Object.keys(tB.customProperties).filter(
					(k) => !(k in tA.customProperties),
				).length,
			},
		},
		null,
		2,
	);
}

const TOOL_HANDLERS: Record<string, ToolHandler> = {
	extract_tokens: handleExtractTokens,
	grade_design: handleGradeDesign,
	battle_designs: handleBattleDesigns,
	get_css_vars: handleGetCssVars,
	lint_tokens: handleLintTokens,
	diff_designs: handleDiffDesigns,
};

function send(msg: unknown): void {
	process.stdout.write(JSON.stringify(msg) + '\n');
}

function sendResponse(id: JsonRpcId, result: unknown): void {
	send({jsonrpc: '2.0', id, result});
}

function sendError(id: JsonRpcId, code: number, message: string): void {
	send({jsonrpc: '2.0', id, error: {code, message}});
}

async function handleMessage(msg: JsonRpcRequest): Promise<void> {
	const {id, method, params} = msg;

	switch (method) {
		case 'initialize': {
			sendResponse(id ?? null, {
				protocolVersion: '2024-11-05',
				capabilities: {tools: {}},
				serverInfo: SERVER_INFO,
			});
			break;
		}

		case 'notifications/initialized':
		case 'initialized':
			// No response needed for notifications
			break;

		case 'tools/list':
			sendResponse(id ?? null, {tools: TOOLS});
			break;

		case 'tools/call': {
			const p = params as {name: string; arguments?: Record<string, unknown>} | undefined;
			if (!p) {
				sendError(id ?? null, -32602, 'Invalid params');
				return;
			}
			const handler = TOOL_HANDLERS[p.name];
			if (!handler) {
				sendError(id ?? null, -32602, `Unknown tool: ${p.name}`);
				return;
			}
			try {
				const result = await handler(p.arguments ?? {});
				sendResponse(id ?? null, {
					content: [{type: 'text', text: result}],
				});
			} catch (err) {
				sendError(
					id ?? null,
					-32603,
					err instanceof Error ? err.message : String(err),
				);
			}
			break;
		}

		case 'ping':
			sendResponse(id ?? null, {});
			break;

		default:
			if (id !== undefined && id !== null) {
				sendError(id, -32601, `Method not found: ${method}`);
			}
	}
}

export async function runMcp(): Promise<void> {
	// Redirect all logging to stderr so stdout stays clean for JSON-RPC
	const origLog = console.log;
	const origInfo = console.info;
	const origWarn = console.warn;
	console.log = (...args: unknown[]) =>
		process.stderr.write(args.map(String).join(' ') + '\n');
	console.info = console.log;
	console.warn = console.log;

	void origLog;
	void origInfo;
	void origWarn;

	process.stderr.write('[designlang MCP] Server started — listening on stdio\n');

	const rl = readline.createInterface({
		input: process.stdin,
		terminal: false,
	});

	rl.on('line', (line) => {
		const trimmed = line.trim();
		if (!trimmed) return;
		let msg: JsonRpcRequest;
		try {
			msg = JSON.parse(trimmed) as JsonRpcRequest;
		} catch {
			sendError(null, -32700, 'Parse error');
			return;
		}
		handleMessage(msg).catch((err) => {
			process.stderr.write(
				`[designlang MCP] Unhandled error: ${err instanceof Error ? err.message : String(err)}\n`,
			);
		});
	});

	rl.on('close', () => {
		process.stderr.write('[designlang MCP] stdin closed, exiting\n');
		process.exit(0);
	});

	// Keep alive
	await new Promise<void>(() => {
		// Resolved only when stdin closes
	});
}
