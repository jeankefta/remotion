import chalk from 'chalk';
import {runExtract} from './commands/extract';
import {runPair} from './commands/pair';
import {runBrand} from './commands/brand';
import {runThemeSwap} from './commands/theme-swap';
import {runPack} from './commands/pack';
import {runRemix} from './commands/remix';
import {runGrade} from './commands/grade';
import {runBattle} from './commands/battle';
import {runClone} from './commands/clone';
import {runFull} from './commands/full';
import type {RemixVocab} from './types';
import {ALL_VOCABS} from './types';

const VERSION = '12.8.0';

const HELP = `
${chalk.bold('designlang')} v${VERSION} — extract and transform design systems from any website

${chalk.bold('Usage:')}

  npx designlang <url>                              Extract design tokens
  npx designlang --full <url>                       Screenshots + responsive + interactions

  npx designlang grade <url> [--badge]              Design report card (+ SVG badge)
  npx designlang battle <url-a> <url-b>             Head-to-head graded comparison

  npx designlang brand <url>                        13-chapter brand guidelines (AI)
  npx designlang clone <url>                        Working Next.js starter (AI)
  npx designlang pack <url>                         Design-system directory

  npx designlang remix <url> --as <vocab>           Restyle in a vocabulary (AI)
  npx designlang remix <url> --all                  All 6 vocabularies (AI)
  npx designlang pair <url-a> <url-b>               Fuse visuals A × voice B
  npx designlang theme-swap <url> --primary <hex>   Recolour around your brand

${chalk.bold('Remix vocabularies:')} ${ALL_VOCABS.join(', ')}

${chalk.bold('AI commands')} (brand, remix, clone) require ${chalk.yellow('ANTHROPIC_API_KEY')} env var.

${chalk.bold('Examples:')}

  npx designlang https://stripe.com
  npx designlang grade stripe.com --badge
  npx designlang battle stripe.com linear.app
  npx designlang brand stripe.com
  npx designlang remix stripe.com --as cyberpunk
  npx designlang theme-swap stripe.com --primary "#ff4800"
  npx designlang pair stripe.com linear.app
  npx designlang pack stripe.com
  npx designlang clone stripe.com
  npx designlang --full stripe.com
`;

function parseFlags(args: string[]): {
	flags: Record<string, string | boolean>;
	positional: string[];
} {
	const flags: Record<string, string | boolean> = {};
	const positional: string[] = [];
	let i = 0;
	while (i < args.length) {
		const arg = args[i];
		if (!arg) { i++; continue; }
		if (arg.startsWith('--')) {
			const key = arg.slice(2);
			const next = args[i + 1];
			if (next && !next.startsWith('--')) {
				flags[key] = next;
				i += 2;
			} else {
				flags[key] = true;
				i++;
			}
		} else {
			positional.push(arg);
			i++;
		}
	}
	return {flags, positional};
}

export async function run(argv: string[]): Promise<void> {
	if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
		console.log(HELP);
		return;
	}

	if (argv[0] === '--version' || argv[0] === '-v') {
		console.log(VERSION);
		return;
	}

	// --full flag may come before the URL
	if (argv[0] === '--full') {
		const url = argv[1];
		if (!url) throw new Error('Usage: designlang --full <url>');
		return runFull(url);
	}

	const {flags, positional} = parseFlags(argv);
	const [command, ...rest] = positional;

	if (!command) {
		console.log(HELP);
		return;
	}

	// Default command: designlang <url>
	if (command.startsWith('http') || command.includes('.')) {
		if (flags['full']) {
			return runFull(command);
		}
		return runExtract(command);
	}

	switch (command) {
		case 'grade': {
			const url = rest[0];
			if (!url) throw new Error('Usage: designlang grade <url> [--badge]');
			return runGrade(url, Boolean(flags['badge']));
		}

		case 'battle': {
			const [urlA, urlB] = rest;
			if (!urlA || !urlB) throw new Error('Usage: designlang battle <url-a> <url-b>');
			return runBattle(urlA, urlB);
		}

		case 'brand': {
			const url = rest[0];
			if (!url) throw new Error('Usage: designlang brand <url>');
			return runBrand(url);
		}

		case 'clone': {
			const url = rest[0];
			if (!url) throw new Error('Usage: designlang clone <url>');
			return runClone(url);
		}

		case 'pack': {
			const url = rest[0];
			if (!url) throw new Error('Usage: designlang pack <url>');
			return runPack(url);
		}

		case 'remix': {
			const url = rest[0];
			if (!url) throw new Error('Usage: designlang remix <url> --as <vocab> | --all');
			const vocabFlag = flags['as'] as string | undefined;
			const allFlag = Boolean(flags['all']);
			if (!allFlag && !vocabFlag) {
				throw new Error(
					`Specify --as <vocab> or --all\nVocabularies: ${ALL_VOCABS.join(', ')}`,
				);
			}
			if (vocabFlag && !ALL_VOCABS.includes(vocabFlag as RemixVocab)) {
				throw new Error(`Unknown vocabulary: ${vocabFlag}\nOptions: ${ALL_VOCABS.join(', ')}`);
			}
			return runRemix(url, vocabFlag as RemixVocab | null, allFlag);
		}

		case 'pair': {
			const [urlA, urlB] = rest;
			if (!urlA || !urlB) throw new Error('Usage: designlang pair <url-a> <url-b>');
			return runPair(urlA, urlB);
		}

		case 'theme-swap': {
			const url = rest[0];
			if (!url) throw new Error('Usage: designlang theme-swap <url> --primary <hex>');
			const primary = flags['primary'] as string | undefined;
			if (!primary) throw new Error('Usage: designlang theme-swap <url> --primary <hex>');
			return runThemeSwap(url, primary);
		}

		default:
			console.error(chalk.red(`Unknown command: ${command}`));
			console.log(HELP);
			process.exit(1);
	}
}
