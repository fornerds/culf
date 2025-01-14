import React, { ReactNode } from 'react';
import styles from './QuestionBox.module.css';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface BaseQuestionBoxProps {
  content: ReactNode;
  imageUrls?: string[];
  imageSizeInfo?: Array<{
    originalSize: number;
    resizedSize: number;
  }>;
}

interface AIQuestionBoxProps extends BaseQuestionBoxProps {
  image?: string;
  isStreaming?: boolean;
  isLoading?: boolean;
}

function AIQuestionBox({ content, image, isStreaming, isLoading }: AIQuestionBoxProps) {
  return (
    <div className={styles.aiContainer}>
      {image && <img src={image} alt="AI" className={styles.aiImage} />}
      <div className={`${styles.box} ${styles.ai}`}>
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

function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (url === "null" || url === "") return false;
  return url.startsWith('http') || url.startsWith('https') || url.startsWith('data:');
}

function UserQuestionBox({ content, imageUrls, imageSizeInfo }: BaseQuestionBoxProps) {
  // 이미지 URL 배열을 단일 문자열로 처리하지 않고, 개별 URL로 처리
  const validImages = (imageUrls || []).filter(isValidImageUrl);

  return (
    <div className={styles.userContainer}>
      {validImages.length > 0 && (
        <div className={styles.imagesGrid}>
          {validImages.map((url, index) => (
            <div key={index} className={styles.imageWrapper}>
              <img src={url} alt={`Uploaded ${index + 1}`} className={styles.messageImage} />
            </div>
          ))}
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