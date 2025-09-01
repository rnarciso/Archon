import { Section } from '../types/prp.types';
import { parseSection } from './sectionDetector';

/**
 * Parses a markdown string into a structured PRP object.
 * This parser is designed to understand a specific markdown structure
 * where sections are delineated by headings and content.
 * It uses a state machine to process the markdown line by line.
 */
export const parseMarkdownToPrp = (markdown: string): Section[] => {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let currentContent: string[] = [];
  let currentDepth = 0;

  const addCurrentSection = () => {
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(parseSection(currentSection));
    }
    currentSection = null;
    currentContent = [];
    currentDepth = 0;
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#+)\s*(.*)$/);
    if (headingMatch) {
      addCurrentSection(); // Finalize previous section

      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      currentSection = {
        title: title,
        content: '', // Will be filled later
        level: level,
        type: 'generic', // Default type, will be refined by sectionDetector
        data: {} // Will be filled later
      };
      currentDepth = level;
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  addCurrentSection(); // Add the last section

  return sections;
};

/**
 * Extracts code examples from a markdown string.
 * Assumes code blocks are fenced with ```
 */
export const extractCodeExamples = (markdown: string): { code: string; language?: string }[] => {
  const codeExamples: { code: string; language?: string }[] = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let currentCode: string[] = [];
  let currentLanguage: string | undefined;

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        codeExamples.push({ code: currentCode.join('\n'), language: currentLanguage });
        currentCode = [];
        currentLanguage = undefined;
        inCodeBlock = false;
      } else {
        currentLanguage = line.substring(3).trim() || undefined;
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      currentCode.push(line);
    }
  }
  return codeExamples;
};

/**
 * Extracts all markdown content from a string, excluding code blocks.
 */
export const extractMarkdownContent = (markdown: string): string => {
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  const markdownContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) {
      markdownContent.push(line);
    }
  }
  return markdownContent.join('\n');
};

/**
 * Checks if a given string contains markdown syntax.
 */
export const containsMarkdown = (text: string): boolean => {
  // This regex checks for common markdown indicators:
  // Headers (#), lists (*, -, +), numbered lists (1.), code blocks (```),
  // blockquotes (>), bold (**), italic (*), inline code (`) 
  if (/^#{1,6}\s+.+|^[-*+]\s+.+$|^\d+\.\s+.+$|```|^>.+$|\*\*.+\*\*|\*.+\*|`[^`]+`/m.test(text)) {
    return true;
  }
  return false;
};
