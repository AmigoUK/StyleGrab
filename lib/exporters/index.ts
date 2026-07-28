import type { StyleCard } from '../types';
import { toCssVariables } from './css';

/**
 * Registry of export formats. v0.1 ships CSS custom properties; Tailwind, SCSS
 * and W3C design tokens land in v0.2. UI reads this list so adding a format is
 * a one-line change here.
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
];

export function getFormat(id: string): ExportFormat | undefined {
  return EXPORT_FORMATS.find((f) => f.id === id);
}

export { toCssVariables };
