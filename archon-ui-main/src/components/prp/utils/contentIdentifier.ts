
import { PRPContent } from '../types/prp.types';

/**
 * Checks if the content is a document with both metadata and markdown content.
 */
export const isDocumentWithMetadata = (content: any): content is { metadata: object; markdown: string } => {
  return (
    typeof content === 'object' &&
    content !== null &&
    'metadata' in content &&
    'markdown' in content &&
    typeof content.markdown === 'string'
  );
};

/**
 * Checks if a given string contains markdown syntax.
 */
export const isMarkdownContent = (text: string): boolean => {
  // This regex checks for common markdown indicators:
  // Headers (#), lists (*, -, +), numbered lists (1.), code blocks (```),
  // blockquotes (>), bold (**), italic (*), inline code (`)
  if (/^#{1,6}\s+.+|^[-*+]\s+.+$|^\d+\.\s+.+$|```|^>.+$|\*\*.+\*\*|\*.+\*|`[^`]+`/m.test(text)) {
    return true;
  }
  return false;
};

/**
 * A type guard to check if the content is a structured PRP document.
 */
export const isPrpDocument = (content: any): content is PRPContent => {
    return typeof content === 'object' && content !== null && !isDocumentWithMetadata(content);
}
