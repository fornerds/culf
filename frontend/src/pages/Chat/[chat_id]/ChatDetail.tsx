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
};

type PreviewImage = {
  id: string;
  file: File;
  url: string;
};

declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    capture?: 'user' | 'environment' | false;
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; 

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

  // ChatInputGroup 높이 감지
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
      
      if (imageFile && imageFile.size > MAX_FILE_SIZE) {
        alert('10메가바이트 이상의 사진을 첨부할 수 없습니다.');
        return;
      }

      const imageUrl = previewImages.length > 0 ? previewImages[0].url : undefined;
  
      // 사용자 메시지를 먼저 추가
      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          content: message,
          imageUrl: imageUrl
        }
      ]);
  
      // AI 응답 로딩 상태 추가
      setMessages((prev) => [
        ...prev,
        { type: 'ai', content: '', isStreaming: true }
      ]);
  
      // 이미지와 메시지를 함께 전송
      const cleanup = await chat.sendMessage(
        message || '', // 빈 문자열이라도 전송
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
  
      // 스트리밍 상태 제거
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );
  
      // 이미지 초기화
      setPreviewImages([]);
  
    } catch (error) {
      console.error('Message send error:', error);
      
      // 에러 메시지 표시
      setMessages((prev) => [
        ...prev.slice(0, -1), // 로딩 메시지 제거
        {
          type: 'ai',
          content: '죄송합니다. 메시지 전송 중 오류가 발생했습니다.',
          isStreaming: false,
        },
      ]);
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // 스크롤 자동 조절
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
  
    if (file.size > MAX_FILE_SIZE) {
      alert('10메가바이트 이상의 사진을 첨부할 수 없습니다.');
      return;
    }
  
    if (previewImages.length >= 4) {
      alert('최대 4개의 이미지만 업로드할 수 있습니다.');
      return;
    }
  
    const reader = new FileReader();
    reader.onload = (e) => {
      const newImage: PreviewImage = {
        id: Date.now().toString(),
        file: file,
        url: e.target?.result as string,
      };
      setPreviewImages((prev) => [...prev, newImage]);
    };
    reader.readAsDataURL(file);
    setIsUploadMenuOpen(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // 같은 파일을 다시 선택할 수 있도록 value 초기화
    e.target.value = '';
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.accept = "image/*";
      // capture 속성을 string으로 명시적 설정
      cameraInputRef.current.setAttribute('capture', 'environment');
      cameraInputRef.current.click();
    }
  };

  const handleAlbumSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*";
      // capture 속성 제거
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
        imageUrl={message.imageUrl} // 이미지 URL 전달
      />
    ),
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
              className={styles.actionButton}
            >
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
            {/* 숨겨진 input 요소들 */}
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
    </div>
  );
}