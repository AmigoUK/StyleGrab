import type { StyleCard } from '../types';
import { toAgentSpec } from './agentSpec';
import { toCssVariables } from './css';
import { toScssVariables } from './scss';
import { toTailwindConfig } from './tailwind';
import { toTokensStudio } from './tokensStudio';
import { toW3CTokens } from './w3c';

/**
 * Registry of export formats. UI reads this list, so adding a format is a
 * one-line change here.
 */

export interface ExportFormat {
  id: string;
  label: string;
  /** File extension without the dot. */
  ext: string;
  /** MIME type for the download blob. */
  mime: string;
  render: (card: StyleCard) => string;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'css', label: 'CSS variables', ext: 'css', mime: 'text/css', render: toCssVariables },
  { id: 'scss', label: 'SCSS variables', ext: 'scss', mime: 'text/x-scss', render: toScssVariables },
  { id: 'tailwind', label: 'Tailwind config', ext: 'js', mime: 'text/javascript', render: toTailwindConfig },
  { id: 'w3c', label: 'W3C design tokens', ext: 'json', mime: 'application/json', render: toW3CTokens },
  { id: 'agent', label: 'Agent spec (STYLE.md)', ext: 'md', mime: 'text/markdown', render: toAgentSpec },
  { id: 'tokens-studio', label: 'Tokens Studio JSON', ext: 'json', mime: 'application/json', render: toTokensStudio },
];

export function getFormat(id: string): ExportFormat | undefined {
  return EXPORT_FORMATS.find((f) => f.id === id);
}

export { toAgentSpec, toCssVariables, toScssVariables, toTailwindConfig, toTokensStudio, toW3CTokens };
