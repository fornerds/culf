import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatDetail.module.css';
import {
  ChatInput,
  FileUploadButton,
  QuestionBox,
  MarkdownChat,
} from '@/components/molecule';
import CameraIcon from '@/assets/icons/camera.svg?react';
import CloseIcon from '@/assets/icons/close.svg?react';
import AlbumIcon from '@/assets/icons/album.svg?react';
import curatorImage from '../../../assets/images/curator01.png';
import { LoadingDots } from '@/components/atom';
import { useSendMessage } from '@/state/server/chatQueries';
import { chat } from '@/api';

type MessageType = {
  type: 'user' | 'ai' | 'suggestion';
  content: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  imageUrl?: string;
  originalSize?: number;
  resizedSize?: number;
};

type PreviewImage = {
  id: string;
  file: File;
  url: string;
  originalSize: number;
  resizedSize: number;
};

declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    capture?: 'user' | 'environment' | false;
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 파일 크기를 사람이 읽기 쉬운 형태로 변환하는 유틸리티 함수
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 이미지 리사이징 유틸리티 함수
const resizeImage = async (file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Blob creation failed'));
            return;
          }
          
          const resizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          
          resolve(resizedFile);
        },
        file.type,
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Image loading failed'));
    };
  });
};

export function ChatDetail() {
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputGroupRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [inputGroupHeight, setInputGroupHeight] = useState(0);
  const isMobile = window.innerWidth < 425;
  const [showSuggestions, setShowSuggestions] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);
  const messageCompleteRef = useRef<boolean>(false);

  const { mutate: sendMessage, isLoading: isSending } = useSendMessage();

  const suggestions = [
    '카라바조는 어떤 작가였어?',
    '바로크 미술에 대해 간단히 설명해줘',
    '카라바조 대표작은 뭐가 있어?',
    '카라바조의 영향을 받은 다른 화가는 누구야?',
  ];

  useEffect(() => {
    const updateInputHeight = () => {
      if (chatInputGroupRef.current) {
        const height = chatInputGroupRef.current.offsetHeight;
        setInputGroupHeight(height);
        document.documentElement.style.setProperty(
          '--input-group-height',
          `${height}px`,
        );
      }
    };

    updateInputHeight();
    window.addEventListener('resize', updateInputHeight);

    const observer = new MutationObserver(updateInputHeight);
    if (chatInputGroupRef.current) {
      observer.observe(chatInputGroupRef.current, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.removeEventListener('resize', updateInputHeight);
      observer.disconnect();
    };
  }, []);

  const handleSendMessage = async (message: string) => {
    try {
      setShowSuggestions(false);
      messageCompleteRef.current = false;
  
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
  
      const imageFile = previewImages.length > 0 ? previewImages[0].file : undefined;
      const originalSize = previewImages.length > 0 ? previewImages[0].originalSize : undefined;
      const resizedSize = previewImages.length > 0 ? previewImages[0].resizedSize : undefined;
      
      if (imageFile && imageFile.size > MAX_FILE_SIZE) {
        alert('10메가바이트 이상의 사진을 첨부할 수 없습니다.');
        return;
      }

      const imageUrl = previewImages.length > 0 ? previewImages[0].url : undefined;
  
      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          content: message,
          imageUrl: imageUrl,
          originalSize: originalSize,
          resizedSize: resizedSize
        }
      ]);
  
      setMessages((prev) => [
        ...prev,
        { type: 'ai', content: '', isStreaming: true }
      ]);
  
      const cleanup = await chat.sendMessage(
        message || '',
        imageFile,
        (chunk) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.isStreaming) {
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMessage,
                  content: lastMessage.content + chunk,
                },
              ];
            }
            return prev;
          });
        }
      );
  
      cleanupRef.current = cleanup;
      messageCompleteRef.current = true;
  
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );
  
      setPreviewImages([]);
  
    } catch (error) {
      console.error('Message send error:', error);
      
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          type: 'ai',
          content: '죄송합니다. 메시지 전송 중 오류가 발생했습니다.',
          isStreaming: false,
        },
      ]);
    }
  };

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
  
    if (previewImages.length >= 4) {
      alert('최대 4개의 이미지만 업로드할 수 있습니다.');
      return;
    }

    try {
      const originalSize = file.size;
      const resizedFile = await resizeImage(file);
      const resizedSize = resizedFile.size;

      // 리사이징 후에도 파일 크기 체크
      if (resizedSize > MAX_FILE_SIZE) {
        alert(`이미지 용량이 너무 큽니다.
원본 크기: ${formatFileSize(originalSize)}
변환 크기: ${formatFileSize(resizedSize)}
10MB 이하의 이미지를 선택해주세요.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage: PreviewImage = {
          id: Date.now().toString(),
          file: resizedFile,
          url: e.target?.result as string,
          originalSize,
          resizedSize
        };
        setPreviewImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(resizedFile);
      setIsUploadMenuOpen(false);

      console.log(`Image resized: 
Original size: ${formatFileSize(originalSize)}
Resized size: ${formatFileSize(resizedSize)}
Reduction: ${((originalSize - resizedSize) / originalSize * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error('Image resize error:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = '';
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.accept = "image/*";
      cameraInputRef.current.setAttribute('capture', 'environment');
      cameraInputRef.current.click();
    }
  };

  const handleAlbumSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  const handleRemoveImage = (id: string) => {
    setPreviewImages((prev) => prev.filter((image) => image.id !== id));
  };

  return (
    <div className={styles.chatDetailContainer}>
      {previewImages.length > 0 && (
        <div
          className={styles.imagePreviewContainer}
          style={
            {
              '--preview-bottom': isUploadMenuOpen
                ? `calc(var(--input-group-height) + 75px + env(safe-area-inset-bottom) - 17px)`
                : `calc(var(--input-group-height) + env(safe-area-inset-bottom) - 17px)`,
            } as React.CSSProperties
          }
        >
          {previewImages.map((image) => (
            <div key={image.id} className={styles.imagePreviewWrapper}>
              <img
                src={image.url}
                alt="Preview"
                className={styles.previewImage}
              />
              <div className={styles.imageSizeInfo}>
                <span>원본: {formatFileSize(image.originalSize)}</span>
                <span>변환: {formatFileSize(image.resizedSize)}</span>
                <span>
                  ({((image.originalSize - image.resizedSize) / image.originalSize * 100).toFixed(1)}% 감소)
                </span>
              </div>
              <button
                onClick={() => handleRemoveImage(image.id)}
                className={styles.removeImageButton}
              >
                <CloseIcon width="8px" height="10px" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.chatContainer} ref={chatContainerRef}>
        {messages.map((message, index) =>
          message.type === 'ai' ? (
            <MarkdownChat
              key={index}
              markdown={message.content}
              isStreaming={message.isStreaming}
              isLoading={message.isLoading}
              image={curatorImage}
            />
          ) : (
            <QuestionBox 
              key={index} 
              type="user" 
              content={message.content}
              imageUrl={message.imageUrl}
              imageSizeInfo={
                message.originalSize && message.resizedSize
                  ? {
                      original: message.originalSize,
                      resized: message.resizedSize
                    }
                  : undefined
              }
            />
          )
        )}
      </div>

      {showSuggestions && (
        <QuestionBox
          type="suggestion"
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
        />
      )}

      <section
        ref={chatInputGroupRef}
        className={`${styles.chatInputGroup} ${isUploadMenuOpen ? styles.menuOpen : ''}`}
      >
        <FileUploadButton
          isOpen={isUploadMenuOpen}
          onToggle={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
        />
        <ChatInput 
          onSendMessage={handleSendMessage}
          hasImage={previewImages.length > 0}
          disabled={isSending}
        />
      </section>

      <div
        className={`${styles.uploadMenu} ${isUploadMenuOpen ? styles.visible : ''}`}
      >
        {isMobile ? (
          <>
            <button
              onClick={handleCameraCapture}
              className={styles.actionButton}>
              <CameraIcon />
              카메라
            </button>
            <button 
              onClick={handleAlbumSelect} 
              className={styles.actionButton}
            >
              <AlbumIcon />
              앨범
            </button>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInputChange}
              ref={cameraInputRef}
              style={{ display: 'none' }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
          </>
        ) : (
          <label htmlFor="fileInput" className={styles.fileInputLabel}>
            <AlbumIcon />
            파일
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              id="fileInput"
            />
          </label>
        )}
      </div>

      <style jsx>{`
        .imageSizeInfo {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 4px;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
      `}</style>
    </div>
  );
}