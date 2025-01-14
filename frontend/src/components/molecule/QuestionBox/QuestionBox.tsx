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

function UserQuestionBox({ content, imageUrls, imageSizeInfo }: BaseQuestionBoxProps) {
  // Filter out any null, undefined, or empty string URLs
  const validImageUrls = imageUrls?.filter(url => url && url.trim() !== '') || [];

  return (
    <div className={styles.userContainer}>
      {validImageUrls.length > 0 && (
        <div className={styles.imagesGrid}>
          {validImageUrls.map((url, index) => {
            // Try to parse the URL if it's a JSON string
            let imageUrl = url;
            try {
              const parsedData = JSON.parse(url);
              if (parsedData.images && parsedData.images[0]?.url) {
                imageUrl = parsedData.images[0].url;
              }
            } catch (e) {
              // URL is not a JSON string, use it as is
            }

            return (
              <div key={index} className={styles.imageWrapper}>
                <img src={imageUrl} alt={`Uploaded ${index + 1}`} className={styles.messageImage} />
                {imageSizeInfo && imageSizeInfo[index] && (
                  <div className={styles.imageSizeInfo}>
                    <span>원본: {formatFileSize(imageSizeInfo[index].originalSize)}</span>
                    <span>변환: {formatFileSize(imageSizeInfo[index].resizedSize)}</span>
                  </div>
                )}
              </div>
            );
          })}
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