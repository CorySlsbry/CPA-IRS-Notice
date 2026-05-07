import { render } from '@react-email/render';
import type { JSX } from 'react';
import { TrialDay0Welcome } from './trial-day0-welcome';
import { TrialDay2FirstNotice } from './trial-day2-first-notice';
import { TrialDay5Crm } from './trial-day5-crm';
import { TrialDay9Workflow } from './trial-day9-workflow';
import { TrialDay11Warning } from './trial-day11-warning';
import { TrialDay14Close } from './trial-day14-close';
import { CpaIntro } from './cpa-intro';
import { CpaCp2000WarStory } from './cpa-cp2000-war-story';
import { WelcomeSubscribe } from './welcome-subscribe';
import { WelcomeResource } from './welcome-resource';
import { WelcomeOffer } from './welcome-offer';
import { TransactionalSignup } from './transactional-signup';
import { TransactionalNoticeMailed } from './transactional-notice-mailed';

export type TemplateProps = {
  contact: Record<string, unknown>;
  firmId: string;
  subject: string;
  unsubUrl: string;
};

const REGISTRY: Record<string, (p: TemplateProps) => JSX.Element> = {
  trial_day0_welcome: TrialDay0Welcome,
  trial_day2_first_notice: TrialDay2FirstNotice,
  trial_day5_crm: TrialDay5Crm,
  trial_day9_workflow: TrialDay9Workflow,
  trial_day11_warning: TrialDay11Warning,
  trial_day14_close: TrialDay14Close,
  cpa_intro: CpaIntro,
  cpa_cp2000_war_story: CpaCp2000WarStory,
  welcome_subscribe: WelcomeSubscribe,
  welcome_resource: WelcomeResource,
  welcome_offer: WelcomeOffer,
  transactional_signup: TransactionalSignup,
  transactional_notice_mailed: TransactionalNoticeMailed,
};

export async function renderEmail(
  templateName: string,
  props: TemplateProps,
): Promise<{ html: string; text: string }> {
  const Component = REGISTRY[templateName];
  if (!Component) {
    throw new Error(`Unknown email template: ${templateName}`);
  }
  const node = Component(props);
  const [html, text] = await Promise.all([
    render(node, { pretty: false }),
    render(node, { plainText: true }),
  ]);
  return { html, text };
}

export const TEMPLATE_NAMES = Object.keys(REGISTRY);
