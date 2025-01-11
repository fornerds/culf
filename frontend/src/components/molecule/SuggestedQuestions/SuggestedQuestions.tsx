// SuggestedQuestions.tsx
import React from 'react';
import styles from './SuggestedQuestions.module.css';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  visible: boolean;
}

export function SuggestedQuestions({ 
  questions, 
  onQuestionClick, 
  visible 
}: SuggestedQuestionsProps) {
  if (!visible || !questions.length) return null;

  return (
    <div className={styles.container}>
      <div className={styles.questionsContainer}>
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className={styles.questionButton}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}