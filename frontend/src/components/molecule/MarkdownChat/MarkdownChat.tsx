import React from 'react';
import { marked } from 'marked';
import styles from './MarkdownChat.module.css';
import { LoadingDots } from '@/components/atom';

interface MarkdownChatProps {
  markdown: string;
  className?: string;
  isStreaming?: boolean;
  isLoading?: boolean;
  image?: string;
}

export function MarkdownChat({
  markdown,
  className,
  isStreaming,
  isLoading,
  image,
}: MarkdownChatProps) {
  const renderMarkdown = (text: string): { __html: string } => {
    marked.use({
      breaks: true,
      gfm: true,
    });

    const html = marked(text);
    return { __html: html };
  };

  return (
    <div className={`${styles.messageContainer} ${className || ''}`}>
      <div className={styles.aiContainer}>
        {image && <img src={image} alt="AI" className={styles.aiImage} />}
        <div className={styles.aiMessage}>
          <div
            className={styles.markdown}
            dangerouslySetInnerHTML={renderMarkdown(markdown)}
          />
          {(isStreaming || isLoading) && (
            <LoadingDots color="#8381FF" size={7} />
          )}
        </div>
      </div>
    </div>
  );
}

export default MarkdownChat;
