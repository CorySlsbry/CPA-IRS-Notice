import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MODELS, estimateCostUsd, getAnthropic } from './client';
import type { Classification } from './classify-notice';

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  const p = path.join(process.cwd(), 'prompts', 'draft_response.v1.md');
  _systemPrompt = await readFile(p, 'utf8');
  return _systemPrompt;
}

export type DraftInput = {
  classification: Classification;
  priorReturnNotes: string;
  strategy: Classification['suggestedResponseStrategy'];
  firm: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
  signer: {
    name: string;
    title: string;
  };
  /** ISO date the letter is dated. */
  letterDate: string;
};

export type DraftResult = {
  draftText: string;
  ircCitations: string[];
  costUsd: number;
  model: string;
  promptVersion: 'v1';
  stopReason: string | null;
};

export async function draftResponse(input: DraftInput): Promise<DraftResult> {
  const system = await loadSystemPrompt();
  const anthropic = getAnthropic();

  const userMessage = [
    `### Classification`,
    '```json',
    JSON.stringify(input.classification, null, 2),
    '```',
    '',
    `### Strategy chosen by CPA`,
    input.strategy,
    '',
    `### Prior-year return notes`,
    input.priorReturnNotes || '(none provided — note this in the letter and mark numbers as [CPA: confirm $X])',
    '',
    `### Firm + signer`,
    `Firm: ${input.firm.name}`,
    `Address: ${input.firm.address}`,
    input.firm.phone ? `Phone: ${input.firm.phone}` : '',
    input.firm.email ? `Email: ${input.firm.email}` : '',
    `Signer: ${input.signer.name}, ${input.signer.title}`,
    `Letter date: ${input.letterDate}`,
    '',
    'Draft the letter now.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await anthropic.messages.create({
    model: MODELS.primary,
    max_tokens: 2500,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('draftResponse: unexpected response shape');
  }
  const draftText = block.text.trim();
  const ircCitations = extractIrcCitations(draftText);
  const costUsd = estimateCostUsd(response.usage);

  return {
    draftText,
    ircCitations,
    costUsd,
    model: response.model,
    promptVersion: 'v1',
    stopReason: response.stop_reason ?? null,
  };
}

const IRC_PATTERN = /(?:IRC|I\.R\.C\.|26 U\.S\.C\.|§)\s*§?\s*(\d{1,5}(?:[A-Z]?(?:\(\w+\))*)?)/g;

function extractIrcCitations(text: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = IRC_PATTERN.exec(text)) !== null) {
    if (match[1]) found.add(`IRC §${match[1]}`);
  }
  return Array.from(found).sort();
}
