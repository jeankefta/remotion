import * as https from 'node:https';
import * as http from 'node:http';
import * as url from 'node:url';

const USER_AGENT =
	'Mozilla/5.0 (compatible; designlang/1.0; +https://github.com/remotion-dev/remotion)';

function fetchUrl(rawUrl: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(rawUrl);
		const lib = parsed.protocol === 'https:' ? https : http;
		const options = {
			hostname: parsed.hostname,
			path: parsed.pathname + parsed.search,
			port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
			method: 'GET',
			headers: {
				'User-Agent': USER_AGENT,
				Accept: 'text/html,text/css,*/*',
			},
			timeout: 15000,
		};

		const req = lib.request(options, (res) => {
			if (
				res.statusCode &&
				res.statusCode >= 300 &&
				res.statusCode < 400 &&
				res.headers.location
			) {
				const redirectUrl = res.headers.location.startsWith('http')
					? res.headers.location
					: `${parsed.protocol}//${parsed.host}${res.headers.location}`;
				resolve(fetchUrl(redirectUrl));
				return;
			}

			let data = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => resolve(data));
		});

		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy();
			reject(new Error(`Request timed out: ${rawUrl}`));
		});
		req.end();
	});
}

function resolveUrl(base: string, href: string): string | null {
	try {
		return new URL(href, base).toString();
	} catch {
		return null;
	}
}

function extractCssUrls(html: string, baseUrl: string): string[] {
	const urls: string[] = [];
	// <link rel="stylesheet" href="...">
	const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi;
	let m: RegExpExecArray | null;
	while ((m = linkRe.exec(html)) !== null) {
		const resolved = resolveUrl(baseUrl, m[1] ?? '');
		if (resolved) urls.push(resolved);
	}
	// Also check href before rel
	const linkRe2 = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["']/gi;
	while ((m = linkRe2.exec(html)) !== null) {
		const resolved = resolveUrl(baseUrl, m[1] ?? '');
		if (resolved && !urls.includes(resolved)) urls.push(resolved);
	}
	return urls;
}

function extractInlineStyles(html: string): string {
	const styles: string[] = [];
	// <style>...</style>
	const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
	let m: RegExpExecArray | null;
	while ((m = styleRe.exec(html)) !== null) {
		styles.push(m[1] ?? '');
	}
	// style="..." inline attrs
	const attrRe = /style=["']([^"']+)["']/gi;
	while ((m = attrRe.exec(html)) !== null) {
		// Wrap in a fake rule so parsers handle it
		styles.push(`x{${m[1] ?? ''}}`);
	}
	return styles.join('\n');
}

export interface FetchedDesign {
	baseUrl: string;
	domain: string;
	html: string;
	css: string;
}

export async function fetchDesign(rawUrl: string): Promise<FetchedDesign> {
	const normalised = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
	const parsed = new URL(normalised);
	const domain = parsed.hostname.replace(/^www\./, '');

	let html: string;
	try {
		html = await fetchUrl(normalised);
	} catch (err) {
		throw new Error(
			`Could not fetch ${normalised}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	const cssUrls = extractCssUrls(html, normalised);
	const cssParts: string[] = [extractInlineStyles(html)];

	await Promise.allSettled(
		cssUrls.slice(0, 20).map(async (cssUrl) => {
			try {
				const text = await fetchUrl(cssUrl);
				cssParts.push(text);
			} catch {
				// ignore failed CSS fetches
			}
		}),
	);

	return {
		baseUrl: normalised,
		domain,
		html,
		css: cssParts.join('\n'),
	};
}

export {url as urlModule};
