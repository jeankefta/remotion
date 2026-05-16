export interface DesignTokens {
	url: string;
	domain: string;
	colors: {
		all: string[];
	};
	typography: {
		fontFamilies: string[];
		fontSizes: string[];
		fontWeights: string[];
		lineHeights: string[];
		letterSpacings: string[];
	};
	spacing: string[];
	spacingBase: number | null;
	borderRadius: string[];
	shadows: string[];
	breakpoints: string[];
	breakpointChanges: number;
	zIndexes: string[];
	customProperties: Record<string, string>;
	layout: {
		gridCount: number;
		flexCount: number;
	};
	interactions: {
		transitionCount: number;
		animationCount: number;
		keyframeCount: number;
	};
}

export interface GradeResult {
	url: string;
	domain: string;
	scores: {
		colorHarmony: number;
		typographyConsistency: number;
		spacingScale: number;
		accessibility: number;
	};
	overall: number;
	grade: string;
	comments: Record<string, string>;
}

export type RemixVocab =
	| 'cyberpunk'
	| 'minimalist'
	| 'brutalist'
	| 'glassmorphism'
	| 'neomorphism'
	| 'corporate';

export const ALL_VOCABS: RemixVocab[] = [
	'cyberpunk',
	'minimalist',
	'brutalist',
	'glassmorphism',
	'neomorphism',
	'corporate',
];
