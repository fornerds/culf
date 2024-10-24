import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatDetail.module.css';
import {
  ChatInput,
  FileUploadButton,
  QuestionBox,
} from '@/components/molecule';
import CameraIcon from '@/assets/icons/camera.svg?react';
import CloseIcon from '@/assets/icons/close.svg?react';
import AlbumIcon from '@/assets/icons/album.svg?react';
import curatorImage from '../../../assets/images/curator01.png';
import { LoadingDots } from '@/components/atom';

type MessageType =
  | {
      [x: string]: any;
      type: 'ai';
      content: string;
    }
  | { type: 'user'; content: string }
  | { type: 'suggestion'; content: string };

type PreviewImage = {
  id: string;
  file: File;
  url: string;
};

export function ChatDetail() {
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputGroupRef = useRef<HTMLElement>(null);
  const [inputGroupHeight, setInputGroupHeight] = useState(0);
  const isMobile = window.innerWidth < 425;
  const [showSuggestions, setShowSuggestions] = useState(true);

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

    // MutationObserver를 사용하여 ChatInputGroup의 크기 변화 감지
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

  const suggestions = [
    '9박 10일 유럽여행 일정 짜줘',
    '사람들이 잘 모르는 제주도 여행 명소를 알려줘',
    '겨울 여행지 추천해줘',
    '가족여행 갈만한 곳 알려줘',
  ];

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (message: string) => {
    setShowSuggestions(false);
    setMessages([...messages, { type: 'user', content: message }]);

    setMessages((prev) => [
      ...prev,
      { type: 'ai', content: '', isLoading: true },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          type: 'ai',
          content: '네, 알겠습니다. 어떤 도움이 필요하신가요?',
          isLoading: false,
        },
      ]);
    }, 1000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleFileSelect = (file: File) => {
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

  const handleRemoveImage = (id: string) => {
    setPreviewImages((prev) => prev.filter((image) => image.id !== id));
  };

  const toggleMenu = () => {
    setIsUploadMenuOpen(!isUploadMenuOpen);
  };

  const handleCameraCapture = () => {
    console.log('Camera capture');
    setIsUploadMenuOpen(false);
  };

  const handleAlbumSelect = () => {
    console.log('Album select');
    setIsUploadMenuOpen(false);
  };

  return (
    <div className={styles.chatDetailContainer}>
      {previewImages.length > 0 && (
        <div
          className={styles.imagePreviewContainer}
          style={
            {
              '--preview-bottom': isUploadMenuOpen
                ? `calc(var(--input-group-height) + 75px + env(safe-area-inset-bottom) - 17px )`
                : `calc(var(--input-group-height) + env(safe-area-inset-bottom) - 17px )`,
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
            <QuestionBox
              key={index}
              type="ai"
              content={
                message.isLoading ? (
                  <LoadingDots color="#8381FF" size={7} />
                ) : (
                  message.content
                )
              }
              image={curatorImage}
            />
          ) : (
            <QuestionBox key={index} type="user" content={message.content} />
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
        <ChatInput onSendMessage={handleSendMessage} />
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
            <button onClick={handleAlbumSelect} className={styles.actionButton}>
              <AlbumIcon />
              앨범
            </button>
          </>
        ) : (
          <label htmlFor="fileInput" className={styles.fileInputLabel}>
            <AlbumIcon />
            파일
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              style={{ display: 'none' }}
              id="fileInput"
            />
          </label>
        )}
      </div>
    </div>
  );
}
