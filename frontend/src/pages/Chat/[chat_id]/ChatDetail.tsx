import React, { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/organism';
import styles from './ChatDetail.module.css';
import {
  ChatInput,
  FileUploadButton,
  QuestionBox,
} from '@/components/molecule';
import CameraIcon from '@/assets/icons/camera.svg?react';
import AlbumIcon from '@/assets/icons/album.svg?react';
import curatorImage from '../../../assets/images/curator01.png';

type MessageType =
  | { type: 'ai'; content: string }
  | { type: 'user'; content: string }
  | { type: 'suggestion'; content: string };

export function ChatDetail() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = window.innerWidth < 425;
  const [showSuggestions, setShowSuggestions] = useState(true);

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
    // AI 응답 시뮬레이션
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { type: 'ai', content: '네, 알겠습니다. 어떤 도움이 필요하신가요?' },
      ]);
    }, 1000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  useEffect(() => {
    // 새 메시지가 추가될 때마다 스크롤을 아래로 이동
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = (file: File) => {
    console.log('Selected file:', file.name);
    setIsMenuOpen(false);
    // Implement file upload logic here
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleCameraCapture = () => {
    console.log('Camera capture');
    setIsMenuOpen(false);
  };

  const handleAlbumSelect = () => {
    console.log('Album select');
    setIsMenuOpen(false);
  };

  return (
    <div className={styles.chatDetailContainer}>
      <Header
        title="해외여행 큐레이터"
        showBackButton={true}
        showMenuButton={true}
        onMenuClick={() => console.log('메뉴 열기')}
      />
      <div className={styles.chatContainer} ref={chatContainerRef}>
        {messages.map((message, index) =>
          message.type === 'ai' ? (
            <QuestionBox
              key={index}
              type="ai"
              content={message.content}
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
        className={`${styles.chatInputGroup} ${isMenuOpen ? styles.menuOpen : ''}`}
      >
        <FileUploadButton
          isOpen={isMenuOpen}
          onToggle={() => setIsMenuOpen(!isMenuOpen)}
        />
        <ChatInput onSendMessage={handleSendMessage} />
      </section>
      <div
        className={`${styles.uploadMenu} ${isMenuOpen ? styles.visible : ''}`}
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
