import React, { ReactNode } from 'react';
import styles from './QuestionBox.module.css';

interface BaseQuestionBoxProps {
  content: ReactNode;
}

// AI QuestionBox
interface AIQuestionBoxProps extends BaseQuestionBoxProps {
  image?: string;
}

function AIQuestionBox({ content, image }: AIQuestionBoxProps) {
  return (
    <div className={styles.aiContainer}>
      {image && <img src={image} alt="AI" className={styles.aiImage} />}
      <div className={`${styles.box} ${styles.ai}`}>
        <div className={styles.content}>{content}</div>
      </div>
    </div>
  );
}

// User QuestionBox
function UserQuestionBox({ content }: BaseQuestionBoxProps) {
  return (
    <div className={`${styles.box} ${styles.user}`}>
      <div className={styles.content}>{content}</div>
    </div>
  );
}

// Suggestion QuestionBox
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
            className={`${styles.box} ${styles.suggestion}`}
            onClick={() => onSuggestionClick(suggestion)}
          >
            <div className={styles.content}>{suggestion}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main QuestionBox component
type QuestionBoxProps =
  | ({ type: 'ai' } & AIQuestionBoxProps)
  | ({ type: 'user' } & BaseQuestionBoxProps)
  | ({ type: 'suggestion' } & SuggestionQuestionBoxProps);

export function QuestionBox(props: QuestionBoxProps) {
  switch (props.type) {
    case 'ai':
      return <AIQuestionBox content={props.content} image={props.image} />;
    case 'user':
      return <UserQuestionBox content={props.content} />;
    case 'suggestion':
      return (
        <SuggestionQuestionBox
          suggestions={props.suggestions}
          onSuggestionClick={props.onSuggestionClick}
        />
      );
  }
}
