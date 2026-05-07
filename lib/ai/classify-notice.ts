import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { MODELS, estimateCostUsd, getAnthropic } from './client';

let _systemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (_systemPrompt) return _systemPrompt;
  const p = path.join(process.cwd(), 'prompts', 'classify_notice.v1.md');
  _systemPrompt = await readFile(p, 'utf8');
  return _systemPrompt;
}

export const noticeTypeEnum = z.enum([
  'CP2000','CP14','CP504','LT11','CP501','CP503','CP523','CP90','CP91','CP297','CP161','LT16','OTHER',
]);

export const classificationSchema = z.object({
  noticeType: noticeTypeEnum,
  noticeDate: z.string().nullable(),
  responseDueDate: z.string().nullable(),
  taxYear: z.number().int().nullable(),
  taxpayerName: z.string().nullable(),
  ssnMasked: z.string().nullable(),
  einMasked: z.string().nullable(),
  amountOwedCents: z.number().int().nullable(),
  interestCents: z.number().int().nullable(),
  penaltyCents: z.number().int().nullable(),
  irsReasoning: z.string(),
  suggestedResponseStrategy: z.enum([
    'agree_pay',
    'disagree_with_documentation',
    'partial_agree',
    'request_abatement',
    'request_installment',
    'unable_to_determine',
  ]),
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable(),
});

export type Classification = z.infer<typeof classificationSchema>;

export type ClassifyInput = {
  /** Page images as base64 PNG/JPEG. */
  pages: { base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' }[];
};

export type ClassifyResult = {
  classification: Classification;
  rawText: string;
  costUsd: number;
  model: string;
  promptVersion: 'v1';
};

/**
 * Vision call → JSON. Caches the system prompt so subsequent calls in
 * the same 5-min window pay cache-read pricing.
 */
export async function classifyNotice(input: ClassifyInput): Promise<ClassifyResult> {
  if (input.pages.length === 0) {
    throw new Error('classifyNotice: at least one page image required');
  }
  const system = await loadSystemPrompt();
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: MODELS.vision,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          ...input.pages.map(
            (p) =>
              ({
                type: 'image',
                source: { type: 'base64', media_type: p.mediaType, data: p.base64 },
              }) as const,
          ),
          {
            type: 'text',
            text: 'Classify this IRS notice. Respond with ONE JSON object matching the schema. No prose.',
          },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('classifyNotice: unexpected response shape');
  }
  const rawText = block.text.trim();
  const json = parseStrictJson(rawText);
  const classification = classificationSchema.parse(json);
  const costUsd = estimateCostUsd(response.usage);

  return {
    classification,
    rawText,
    costUsd,
    model: response.model,
    promptVersion: 'v1',
  };
}

function parseStrictJson(text: string): unknown {
  // Strip ```json fences if the model added them despite instructions.
  const trimmed = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(trimmed);
}
