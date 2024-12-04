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
};

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
  const cleanupRef = useRef<(() => void) | null>(null);
  const messageCompleteRef = useRef<boolean>(false);

  const { mutate: sendMessage, isLoading: isSending } = useSendMessage();

  const suggestions = [
    '2박 3일 유럽여행 일정 짜줘',
    '사람들이 잘 모르는 제주도 여행 명소를 알려줘',
    '서울 근교 겨울 여행지 추천해줘',
    '서울 근교 가족여행 갈만한 곳 알려줘',
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

      // 이전 스트리밍 정리
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      // 사용자 메시지 추가
      setMessages((prev) => [...prev, { type: 'user', content: message }]);

      // AI 메시지 컨테이너 추가
      setMessages((prev) => [
        ...prev,
        { type: 'ai', content: '', isStreaming: true },
      ]);

      const imageFile =
        previewImages.length > 0 ? previewImages[0].file : undefined;

      const cleanup = await chat.sendMessage(message, imageFile, (chunk) => {
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
      });

      // cleanup이 undefined일 경우 null 할당
      cleanupRef.current = cleanup || null;
      messageCompleteRef.current = true;

      // 스트리밍 완료 후 처리
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg,
        ),
      );

      setPreviewImages([]);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('메시지 전송 중 오류가 발생했습니다.');

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

  // const handleSendMessage = (message: string) => {
  //   setShowSuggestions(false);

  //   // 사용자 메시지 추가
  //   setMessages((prev) => [...prev, { type: 'user', content: message }]);

  //   // 로딩 메시지 추가
  //   setMessages((prev) => [
  //     ...prev,
  //     { type: 'ai', content: '', isLoading: true },
  //   ]);

  //   const imageFile =
  //     previewImages.length > 0 ? previewImages[0].file : undefined;

  //   sendMessage(
  //     { question: message, imageFile },
  //     {
  //       onSuccess: (data) => {
  //         // 로딩 메시지 제거 후 실제 응답 추가
  //         setMessages((prev) => [
  //           ...prev.slice(0, -1),
  //           {
  //             type: 'ai',
  //             content: data.answer,
  //             isLoading: false,
  //           },
  //         ]);
  //         // 이미지 프리뷰 초기화
  //         setPreviewImages([]);
  //       },
  //       onError: (error) => {
  //         console.error('Error sending message:', error);
  //         alert('메시지 전송 중 오류가 발생했습니다.');
  //         // 로딩 메시지를 에러 메시지로 교체
  //         setMessages((prev) => [
  //           ...prev.slice(0, -1),
  //           {
  //             type: 'ai',
  //             content: '죄송합니다. 메시지 전송 중 오류가 발생했습니다.',
  //             isLoading: false,
  //           },
  //         ]);
  //       },
  //     },
  //   );
  // };

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

  const handleCameraCapture = () => {
    // 모바일 카메라 캡처 구현
    setIsUploadMenuOpen(false);
  };

  const handleAlbumSelect = () => {
    // 모바일 앨범 선택 구현
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
