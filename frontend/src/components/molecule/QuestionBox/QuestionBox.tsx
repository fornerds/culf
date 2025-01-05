// QuestionBox.tsx
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
  imageUrls?: string[];  // 단일 imageUrl 대신 imageUrls 배열로 변경
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

function UserQuestionBox({ content, imageUrls, imageSizeInfo }: BaseQuestionBoxProps) {
  return (
    <div className={styles.userContainer}>
      {imageUrls && imageUrls.length > 0 && (
        <div className={styles.imagesGrid}>
          {imageUrls.map((url, index) => (
            <div key={index} className={styles.imageWrapper}>
              <img src={url} alt={`Uploaded ${index + 1}`} className={styles.messageImage} />
              {/* {imageSizeInfo && imageSizeInfo[index] && (
                <div className={styles.imageSizeInfo}>
                  <span>원본: {formatFileSize(imageSizeInfo[index].originalSize)}</span>
                  <span>변환: {formatFileSize(imageSizeInfo[index].resizedSize)}</span>
                </div>
              )} */}
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