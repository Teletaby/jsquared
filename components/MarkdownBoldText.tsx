import { ReactNode } from 'react';

interface MarkdownBoldTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with markdown-style bold (**text**) converted to HTML bold
 * @param text Text that may contain **bold** markdown
 * @param className Optional className for the container
 * @returns React component rendering parsed text
 */
export default function MarkdownBoldText({ text, className = '' }: MarkdownBoldTextProps): ReactNode {
  const parts: (string | ReactNode)[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Add bold text
    parts.push(
      <strong key={`bold-${match.index}`} className="font-bold text-white">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // If no matches found, return original text
  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return <span className={className}>{parts}</span>;
}
