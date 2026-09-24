/**
 * Documentation & Setup Extractor
 * Parses README, Markdown, and documentation files into structured sections with headings.
 * Zero hardcoded repository logic.
 */

import type { DocSectionNode } from './types.js';

export class DocExtractor {
  /**
   * Parses Markdown files into structured DocSectionNodes based on # Headings.
   */
  static extractDocSections(filePath: string, lines: string[]): DocSectionNode[] {
    const sections: DocSectionNode[] = [];
    let currentTitle = 'Overview';
    let currentLevel = 1;
    let currentStartLine = 1;
    let currentContent: string[] = [];
    const allHeadings: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineText = lines[i];
      const headingMatch = lineText.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        if (currentContent.length > 0) {
          sections.push({
            id: `doc_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${currentStartLine}`,
            title: currentTitle,
            level: currentLevel,
            filePath,
            startLine: currentStartLine,
            endLine: i,
            content: currentContent.join('\n').trim(),
            headings: [...allHeadings]
          });
          currentContent = [];
        }

        currentLevel = headingMatch[1].length;
        currentTitle = headingMatch[2].trim();
        allHeadings.push(currentTitle);
        currentStartLine = lineNum;
        currentContent.push(lineText);
      } else {
        currentContent.push(lineText);
      }
    }

    if (currentContent.length > 0) {
      sections.push({
        id: `doc_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${currentStartLine}`,
        title: currentTitle,
        level: currentLevel,
        filePath,
        startLine: currentStartLine,
        endLine: lines.length,
        content: currentContent.join('\n').trim(),
        headings: [...allHeadings]
      });
    }

    return sections;
  }
}
