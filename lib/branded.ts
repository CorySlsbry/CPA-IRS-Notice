/**
 * Branded types per CLAUDE.md C-5: prefer branded types for IDs.
 * Compile-time tags only; zero runtime cost.
 */

declare const brand: unique symbol;
export type Brand<T, B> = T & { readonly [brand]: B };

export type FirmId = Brand<string, 'FirmId'>;
export type UserId = Brand<string, 'UserId'>;
export type ContactId = Brand<string, 'ContactId'>;
export type CompanyId = Brand<string, 'CompanyId'>;
export type NoticeId = Brand<string, 'NoticeId'>;
export type ResponseId = Brand<string, 'ResponseId'>;
export type ClientId = Brand<string, 'ClientId'>;
export type TagId = Brand<string, 'TagId'>;
export type SegmentId = Brand<string, 'SegmentId'>;
export type PipelineId = Brand<string, 'PipelineId'>;
export type DealId = Brand<string, 'DealId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type EmailSendId = Brand<string, 'EmailSendId'>;
export type WorkflowId = Brand<string, 'WorkflowId'>;
export type WorkflowRunId = Brand<string, 'WorkflowRunId'>;
export type FormId = Brand<string, 'FormId'>;
export type SessionId = Brand<string, 'SessionId'>;

export const asFirmId = (s: string) => s as FirmId;
export const asUserId = (s: string) => s as UserId;
export const asContactId = (s: string) => s as ContactId;
export const asNoticeId = (s: string) => s as NoticeId;
export const asWorkflowId = (s: string) => s as WorkflowId;
export const asWorkflowRunId = (s: string) => s as WorkflowRunId;
