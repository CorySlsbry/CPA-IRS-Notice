import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MODELS, getAnthropic } from '@/lib/ai/client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

let _systemPrompt: string | null = null;
async function loadSystemPrompt() {
  if (_systemPrompt) return _systemPrompt;
  const p = path.join(process.cwd(), 'prompts', 'workflow_ai_step.v1.md');
  _systemPrompt = await readFile(p, 'utf8');
  return _systemPrompt;
}

export type AiStepArgs = {
  firmId: string;
  contactId: string;
  prompt: string;
  expectedOutputShape: Record<string, unknown>;
  context: Record<string, unknown>;
};

export async function runAiStep(args: AiStepArgs): Promise<unknown> {
  const supabase = getSupabaseAdmin();
  const [{ data: contact }, { data: activity }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', args.contactId).single(),
    supabase
      .from('activities')
      .select('type, payload, occurred_at')
      .eq('contact_id', args.contactId)
      .order('occurred_at', { ascending: false })
      .limit(30),
  ]);

  const system = await loadSystemPrompt();
  const anthropic = getAnthropic();

  const userMessage = JSON.stringify(
    {
      contact,
      recent_activity: activity,
      firm_prompt: args.prompt,
      expected_output_shape: args.expectedOutputShape,
      context: args.context,
    },
    null,
    2,
  );

  const response = await anthropic.messages.create({
    model: MODELS.primary,
    max_tokens: 700,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });
  const block = response.content[0];
  if (!block || block.type !== 'text') throw new Error('ai step: bad response shape');
  const text = block.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  try {
    return JSON.parse(text);
  } catch {
    return { status: 'parse_error', raw: text };
  }
}
