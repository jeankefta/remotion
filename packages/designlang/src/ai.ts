import type {DesignTokens, RemixVocab} from './types';

let Anthropic: typeof import('@anthropic-ai/sdk').default | null = null;

async function getClient(): Promise<import('@anthropic-ai/sdk').default> {
	if (Anthropic === null) {
		const mod = await import('@anthropic-ai/sdk');
		Anthropic = mod.default;
	}
	const apiKey = process.env['ANTHROPIC_API_KEY'];
	if (!apiKey) {
		throw new Error(
			'ANTHROPIC_API_KEY environment variable is required for this command.\n' +
				'Get yours at https://console.anthropic.com/',
		);
	}
	return new Anthropic({apiKey});
}

async function complete(prompt: string): Promise<string> {
	const client = await getClient();
	const msg = await client.messages.create({
		model: 'claude-sonnet-4-6',
		max_tokens: 4096,
		messages: [{role: 'user', content: prompt}],
	});
	const block = msg.content[0];
	if (block?.type === 'text') return block.text;
	return '';
}

function tokenSummary(tokens: DesignTokens): string {
	return JSON.stringify(
		{
			domain: tokens.domain,
			colors: tokens.colors.all.slice(0, 10),
			fontFamilies: tokens.typography.fontFamilies,
			fontSizes: tokens.typography.fontSizes.slice(0, 8),
			fontWeights: tokens.typography.fontWeights,
			spacing: tokens.spacing.slice(0, 8),
			borderRadius: tokens.borderRadius.slice(0, 5),
			shadows: tokens.shadows.slice(0, 4),
			breakpoints: tokens.breakpoints,
			customProperties: Object.fromEntries(
				Object.entries(tokens.customProperties).slice(0, 20),
			),
		},
		null,
		2,
	);
}

export async function generateBrandGuidelines(
	tokens: DesignTokens,
): Promise<string> {
	const prompt = `You are a senior brand strategist and design director. Based on the following extracted design tokens from ${tokens.domain}, write a comprehensive brand guidelines document in Markdown format.

Design Tokens:
${tokenSummary(tokens)}

Write a complete brand guidelines document with exactly these 13 chapters:
1. Brand Overview & Mission
2. Logo System & Usage Rules
3. Primary Colour Palette
4. Secondary & Accent Colours
5. Colour in Context (do/don't)
6. Typography System
7. Type Hierarchy & Scale
8. Spacing & Layout Grid
9. Elevation & Depth (shadows, layers)
10. Iconography & Illustration Style
11. Motion & Animation Principles
12. Photography & Imagery Guidelines
13. Digital & Print Applications

For each chapter, write 3-5 paragraphs of professional brand guidelines content. Ground every claim in the actual extracted tokens where possible. Use concrete specifications (hex values, pixel values, font names) from the token data. Format as clean Markdown with section headers.`;

	return complete(prompt);
}

export async function remixTokens(
	tokens: DesignTokens,
	vocab: RemixVocab,
): Promise<string> {
	const vocabDescriptions: Record<RemixVocab, string> = {
		cyberpunk:
			'neon colors (electric cyan, hot pink, acid green on near-black), glitch effects, pixel/monospace fonts, sharp edges, scanlines aesthetic',
		minimalist:
			'maximum white space, 2-3 neutral colors, single clean sans-serif, 8px grid, almost no decoration, generous margins',
		brutalist:
			'raw exposed structure, stark black and white, thick borders, bold ugly fonts, loud uppercase, zero polish, grid broken intentionally',
		glassmorphism:
			'frosted-glass backgrounds (rgba whites), heavy blur effects, very rounded corners (16px+), soft colored shadows, gradient overlays',
		neomorphism:
			'soft UI: very light grey background, elements that appear extruded via dual light/dark shadows, subtle, calm, no harsh contrasts',
		corporate:
			'professional blues and greys, clean grid, moderate rounded corners, readable serif/sans pair, formal and trustworthy, conservative spacing',
	};

	const prompt = `You are a design system engineer. Transform the following design tokens from ${tokens.domain} into the "${vocab}" design vocabulary: ${vocabDescriptions[vocab]}.

Original tokens:
${tokenSummary(tokens)}

Produce a complete CSS custom properties file (:root block + body/element overrides) that fully reimagines this design in the ${vocab} style. Include:
- All color variables remapped to the vocabulary
- Typography changed to match the aesthetic (suggest specific Google Fonts or system fonts)
- Spacing adjustments if the vocabulary demands it
- Border radius changes
- Box shadow changes
- Any additional CSS needed for the vocabulary's signature look

Return ONLY the CSS code, no prose. Start with a brief comment block naming the vocabulary and the source site.`;

	return complete(prompt);
}

export async function generateCloneScaffold(
	tokens: DesignTokens,
): Promise<string> {
	const prompt = `You are a senior frontend engineer. Based on the extracted design tokens from ${tokens.domain}, generate a complete Next.js 14 App Router project scaffold.

Design Tokens:
${tokenSummary(tokens)}

Generate the following files, clearly delimited:

=== app/globals.css ===
Full CSS with :root variables from the design tokens

=== app/layout.tsx ===
Root layout with metadata and font imports matching the detected fonts

=== app/page.tsx ===
Homepage with hero section, features grid, and CTA that replicates the general visual style

=== components/ui/Button.tsx ===
Typed React button component in the site's style

=== components/ui/Card.tsx ===
Typed React card component

=== tailwind.config.ts ===
Tailwind config extending with all brand tokens

=== README.md ===
Quick start instructions

Return ONLY the file contents with === filename === delimiters. No other prose.`;

	return complete(prompt);
}

export async function generateThemeSwapCss(
	tokens: DesignTokens,
	primaryHex: string,
): Promise<string> {
	const prompt = `You are a design engineer. The website ${tokens.domain} uses these design tokens:

${tokenSummary(tokens)}

The user wants to recolour this design so the primary brand colour becomes ${primaryHex}.

Generate a CSS override file that:
1. Replaces the primary colour with ${primaryHex}
2. Derives complementary shades (light/dark variants) algorithmically
3. Updates all related colour variables (border, shadow colours that derive from the brand colour)
4. Preserves neutral colors (greys, blacks, whites) unless they are tinted by the primary

Return ONLY the CSS. Start with :root overrides then any element-level overrides needed.`;

	return complete(prompt);
}
