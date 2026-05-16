import type {GradeResult} from './types';

function gradeColor(grade: string): string {
	if (grade.startsWith('A')) return '#2da44e';
	if (grade.startsWith('B')) return '#0969da';
	if (grade.startsWith('C')) return '#bf8700';
	if (grade.startsWith('D')) return '#d4262c';
	return '#6e7781';
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function textWidth(s: string): number {
	return s.length * 7;
}

export function generateBadgeSvg(result: GradeResult): string {
	const label = 'design score';
	const value = `${result.grade} · ${result.overall}/100`;
	const labelW = textWidth(label) + 20;
	const valueW = textWidth(value) + 20;
	const totalW = labelW + valueW;
	const color = gradeColor(result.grade);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <title>${escapeXml(label)}: ${escapeXml(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalW}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110">
    <text aria-hidden="true" x="${(labelW / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelW - 10) * 10}">${escapeXml(label)}</text>
    <text x="${(labelW / 2) * 10}" y="140" transform="scale(.1)" textLength="${(labelW - 10) * 10}">${escapeXml(label)}</text>
    <text aria-hidden="true" x="${(labelW + valueW / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(valueW - 10) * 10}">${escapeXml(value)}</text>
    <text x="${(labelW + valueW / 2) * 10}" y="140" transform="scale(.1)" textLength="${(valueW - 10) * 10}">${escapeXml(value)}</text>
  </g>
</svg>`;
}
