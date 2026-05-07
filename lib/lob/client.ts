import { Configuration, LettersApi } from '@lob/lob-typescript-sdk';

let _letters: LettersApi | null = null;

export function getLobLetters(): LettersApi {
  if (_letters) return _letters;
  const apiKey = process.env.LOB_API_KEY;
  if (!apiKey) throw new Error('LOB_API_KEY missing');
  _letters = new LettersApi(new Configuration({ username: apiKey }));
  return _letters;
}

/**
 * Convert a markdown response letter into the HTML Lob expects. Lob
 * accepts a full HTML doc with print-friendly CSS — we render plain
 * paragraphs at 12pt with 1-inch margins, the IRS-friendly default.
 */
export function letterMarkdownToHtml(markdown: string, opts: { firmName: string; logoUrl?: string }): string {
  const safe = markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = safe
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
  const logoBlock = opts.logoUrl
    ? `<div style="text-align:right;margin-bottom:24px;"><img src="${opts.logoUrl}" alt="${opts.firmName}" style="max-height:60px;"/></div>`
    : `<div style="text-align:right;margin-bottom:24px;font-weight:600;">${opts.firmName}</div>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
@page { size: letter; margin: 1in; }
body { font: 12pt/1.45 'Times New Roman', Times, serif; color: #111; }
p { margin: 0 0 12pt; }
</style>
</head><body>${logoBlock}${paragraphs}</body></html>`;
}
