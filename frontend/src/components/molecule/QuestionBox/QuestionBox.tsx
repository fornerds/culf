// QuestionBox.tsx
import React, { ReactNode } from 'react';
import styles from './QuestionBox.module.css';

interface BaseQuestionBoxProps {
  content: ReactNode;
  imageUrl?: string;
}

interface AIQuestionBoxProps extends BaseQuestionBoxProps {
  image?: string;
  isStreaming?: boolean;
  isLoading?: boolean;
}

function AIQuestionBox({ content, image, imageUrl, isStreaming, isLoading }: AIQuestionBoxProps) {
  return (
    <div className={styles.aiContainer}>
      {image && <img src={image} alt="AI" className={styles.aiImage} />}
      <div className={`${styles.box} ${styles.ai}`}>
        {imageUrl && (
          <div className={styles.imageWrapper}>
            <img src={imageUrl} alt="Response" className={styles.messageImage} />
          </div>
        )}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loadingIndicator}>
              답변을 생성하고 있습니다...
            </div>
          ) : (
            content
          )}
        </div>
      </div>
    </div>
  );
}

function UserQuestionBox({ content, imageUrl }: BaseQuestionBoxProps) {
  return (
    <div className={styles.userContainer}>
        {imageUrl && (
          <div className={styles.imageWrapper}>
            <img src={imageUrl} alt="Uploaded" className={styles.messageImage} />
          </div>
        )}
        <div className={styles.content}>{content}</div>
    </div>
  );
}

interface SuggestionQuestionBoxProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}

function SuggestionQuestionBox({
  suggestions,
  onSuggestionClick,
}: SuggestionQuestionBoxProps) {
  return (
    <div className={styles.suggestionListContainer}>
      <div className={styles.suggestionList}>
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`${styles.suggestion}`}
            onClick={() => onSuggestionClick(suggestion)}
          >
            <div className={styles.content}>{suggestion}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

type QuestionBoxProps =
  | ({ type: 'ai' } & AIQuestionBoxProps)
  | ({ type: 'user' } & BaseQuestionBoxProps)
  | ({ type: 'suggestion' } & SuggestionQuestionBoxProps);

export function QuestionBox(props: QuestionBoxProps) {
  switch (props.type) {
    case 'ai':
      return <AIQuestionBox {...props} />;
    case 'user':
      return <UserQuestionBox {...props} />;
    case 'suggestion':
      return (
        <SuggestionQuestionBox
          suggestions={props.suggestions}
          onSuggestionClick={props.onSuggestionClick}
        />
      );
  }
}