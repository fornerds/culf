import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import styles from './ChatDetail.module.css';
import {
  ChatInput,
  FileUploadButton,
  QuestionBox,
  MarkdownChat,
  SlideUpModal,
  SuggestedQuestions,
} from '@/components/molecule';
import CameraIcon from '@/assets/icons/camera.svg?react';
import CloseIcon from '@/assets/icons/close.svg?react';
import AlbumIcon from '@/assets/icons/album.svg?react';
import { chat, token, subscription } from '@/api';
import { useChatRoomStore } from '@/state/client/chatRoomStore';
import { useHeaderStore } from '@/state/client/useHeaderStore';

type MessageType = {
  type: 'user' | 'ai';
  content: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  imageUrls?: string[];
  imageSizeInfo?: Array<{
    originalSize: number;
    resizedSize: number;
  }>;
  recommendedQuestions?: string[];
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES = 4;

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const resizeImage = async (
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.8,
): Promise<File> => {
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
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Image loading failed'));
    };
  });
};

export function ChatDetail() {
  const { roomId } = useParams<{ roomId: string }>();
  const { currentRoom } = useChatRoomStore();
  const queryClient = useQueryClient();
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputGroupRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [inputGroupHeight, setInputGroupHeight] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const messageCompleteRef = useRef<boolean>(true);
  const isMobile = window.innerWidth < 425;

  // 추천 질문 상태를 하나로 통합
  const [suggestions, setSuggestions] = useState<{
    questions: string[];
    visible: boolean;
  }>({
    questions: [],
    visible: false,
  });

  const { setTitle } = useHeaderStore();

  // 추천 질문 업데이트 함수
  const updateSuggestions = useCallback(
    (questions: string[], visible: boolean) => {
      console.log('updateSuggestions called:', { questions, visible }); // 디버깅용
      setSuggestions({ questions, visible });
    },
    [],
  );

  // 채팅방 데이터 조회
  const { data: roomData } = useQuery({
    queryKey: ['chatRoom', roomId],
    queryFn: async () => {
      const response = await chat.getChatRoomById(roomId);
      return response.data;
    },
    enabled: !!roomId,
    staleTime: 1000,
  });

  // 큐레이터 정보 조회
  const { data: curatorData } = useQuery({
    queryKey: ['chatRoomCurator', roomId],
    queryFn: async () => {
      const response = await chat.getChatRoomCurator(roomId);
      return response.data;
    },
    enabled: !!roomId && !roomData?.conversations?.length,
    staleTime: 1000,
  });

  const { data: tokenInfo, error: tokenError }: UseQueryResult<any, Error> =
    useQuery({
      queryKey: ['tokenInfo'],
      queryFn: async () => {
        const response = await token.getMyTokenInfo();
        return response.data;
      },
      staleTime: 0,
    });

  const { data: subscriptionInfo } = useQuery({
    queryKey: ['subscriptionInfo'],
    queryFn: async () => {
      const response = await subscription.isSubscribed();
      return response.data;
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (roomData) {
      // 새로운 채팅방인 경우
      if (!roomData.conversations?.length && curatorData) {
        useChatRoomStore.getState().setCurrentRoom({
          roomId: roomData.room_id,
          curatorId: curatorData.curator.curator_id,
          curatorInfo: {
            name: curatorData.curator.name,
            profileImage: curatorData.curator.profile_image,
            persona: curatorData.curator.persona,
          },
        });
        setTitle(curatorData.curator.name);
        updateSuggestions([], false); // 새 채팅방에서는 추천 질문 숨김
        setMessages([]);
      }
      // 기존 채팅방인 경우
      else if (roomData.conversations?.length) {
        useChatRoomStore.getState().setCurrentRoom({
          roomId: roomData.room_id,
          curatorId: roomData.curator.curator_id,
          curatorInfo: {
            name: roomData.curator.name,
            profileImage: roomData.curator.profile_image,
            persona: roomData.curator.persona,
          },
        });
        setTitle(roomData.curator.name);

        const messages = roomData.conversations
          .map((conv) => [
            {
              type: 'user' as const,
              content: conv.question,
              ...(conv.question_images && {
                imageUrls: Array.isArray(conv.question_images)
                  ? conv.question_images
                  : [conv.question_images],
                imageSizeInfo: conv.image_size_info,
              }),
            },
            {
              type: 'ai' as const,
              content: conv.answer,
              recommendedQuestions: conv.recommended_questions,
            },
          ])
          .flat();
        setMessages(messages);

        // 마지막 대화의 추천 질문 표시 - 메시지 설정 후 약간의 지연
        const lastConversation =
          roomData.conversations[roomData.conversations.length - 1];
        if (lastConversation?.recommended_questions?.length) {
          setTimeout(() => {
            updateSuggestions(lastConversation.recommended_questions, true);
          }, 200);
        } else {
          updateSuggestions([], false);
        }
      }
    }
  }, [roomData, curatorData, updateSuggestions]);

  const handleSendMessage = async (message?: string) => {
    try {
      if (!currentRoom?.roomId) {
        throw new Error('채팅방 정보가 없습니다.');
      }

      // 메시지 전송 전에 토큰과 구독 정보를 먼저 갱신
      await queryClient.invalidateQueries({ queryKey: ['tokenInfo'] });
      await queryClient.invalidateQueries({ queryKey: ['subscriptionInfo'] });

      try {
        const tokenData = await queryClient.fetchQuery({
          queryKey: ['tokenInfo'],
          queryFn: async () => {
            const response = await token.getMyTokenInfo();
            console.log('Token Response:', response.data);
            return response.data;
          },
          staleTime: 0,
        });

        const subscriptionData = await queryClient.fetchQuery({
          queryKey: ['subscriptionInfo'],
          queryFn: async () => {
            const response = await subscription.getMySubscription();
            console.log('Subscription Response:', response.data);
            return response.data;
          },
          staleTime: 0,
        });

        const hasValidTokens = tokenData?.total_tokens > 0;
        const hasActiveSubscription = subscriptionInfo?.is_subscribed;

        console.log('Validation Results:', {
          hasValidTokens,
          hasActiveSubscription,
          tokenCount: tokenData?.total_tokens,
        });

        if (!hasValidTokens && !hasActiveSubscription) {
          setIsModalOpen(true);
          return;
        }
      } catch (error: any) {
        console.error('Token/Subscription check error:', error);
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      const imageFiles = previewImages.map((preview) => preview.file);

      if (imageFiles.some((file) => file.size > MAX_FILE_SIZE)) {
        alert('10메가바이트 이상의 사진을 첨부할 수 없습니다.');
        return;
      }

      const formData = new FormData();
      if (message) formData.append('question', message);
      formData.append('room_id', currentRoom.roomId);
      imageFiles.forEach((file) => formData.append('image_files', file));

      // 추천 질문 숨기기 - 한 번만 호출
      updateSuggestions([], false);
      messageCompleteRef.current = false;

      // 새 메시지 추가
      const userMessage: MessageType = {
        type: 'user',
        content: message || '',
        ...(previewImages.length > 0 && {
          imageUrls: previewImages.map((preview) => preview.url),
          imageSizeInfo: previewImages.map((preview) => ({
            originalSize: preview.originalSize,
            resizedSize: preview.resizedSize,
          })),
        }),
      };

      const aiMessage = {
        type: 'ai' as const,
        content: '',
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, aiMessage]);
      setPreviewImages([]);
      setIsUploadMenuOpen(false);

      let currentContent = '';

      try {
        const response = await chat.sendMessage(formData, (chunk) => {
          currentContent += chunk;
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.type === 'ai' && lastMessage.isStreaming) {
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMessage,
                  content: currentContent,
                },
              ];
            }
            return prev;
          });
        });

        console.log('Stream completed, response data:', response);

        // 스트리밍 완료 후 최종 메시지 업데이트
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.type === 'ai') {
            return [
              ...prev.slice(0, -1),
              {
                type: 'ai' as const,
                content: currentContent,
                isStreaming: false,
                recommendedQuestions: response?.recommended_questions || [],
              },
            ];
          }
          return prev;
        });

        // 추천 질문 업데이트 - 약간의 지연을 주어 메시지 렌더링 완료 후 표시
        if (response?.recommended_questions?.length) {
          // 메시지 업데이트 후 추천 질문 표시를 위한 최소 지연
          setTimeout(() => {
            updateSuggestions(response.recommended_questions, true);
          }, 100);
        } else {
          updateSuggestions([], false);
        }

        messageCompleteRef.current = true;

        // 쿼리 캐시 업데이트
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['chatRooms'] }),
          queryClient.invalidateQueries({
            queryKey: ['chatRoom', currentRoom.roomId],
          }),
          queryClient.invalidateQueries({ queryKey: ['tokenInfo'] }),
          queryClient.invalidateQueries({ queryKey: ['subscriptionInfo'] }),
        ]);

        // 채팅창 스크롤
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        throw streamError;
      }
    } catch (error) {
      console.error('Message send error:', error);
      messageCompleteRef.current = true;

      // 에러 메시지 표시
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          type: 'ai' as const,
          content: '죄송합니다. 메시지 전송 중 오류가 발생했습니다.',
          isStreaming: false,
        },
      ]);

      // 추천 질문 초기화
      updateSuggestions([], false);

      // 404 에러 처리
      if (error instanceof Error) {
        const is404Error =
          'response' in error && (error as any).response?.status === 404;
        if (is404Error) {
          setIsModalOpen(true);
        }
      }
    }
  };

  // 중복된 useEffect 제거 - 이미 handleSendMessage에서 처리됨

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (previewImages.length >= MAX_IMAGES) {
      alert(`최대 ${MAX_IMAGES}개의 이미지만 업로드할 수 있습니다.`);
      return;
    }

    try {
      const originalSize = file.size;
      const resizedFile = await resizeImage(file);
      const resizedSize = resizedFile.size;

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
          resizedSize,
        };
        setPreviewImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(resizedFile);
      setIsUploadMenuOpen(false);

      console.log(`Image resized: 
Original size: ${formatFileSize(originalSize)}
Resized size: ${formatFileSize(resizedSize)}
Reduction: ${(((originalSize - resizedSize) / originalSize) * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('Image resize error:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = MAX_IMAGES - previewImages.length;

    if (files.length > remainingSlots) {
      alert(`이미지는 최대 ${MAX_IMAGES}개까지만 업로드할 수 있습니다.`);
      files.slice(0, remainingSlots).forEach((file) => handleFileSelect(file));
    } else {
      files.forEach((file) => handleFileSelect(file));
    }
    e.target.value = '';
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.accept = 'image/*';
      cameraInputRef.current.setAttribute('capture', 'environment');
      cameraInputRef.current.click();
    }
  };

  const handleAlbumSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  const handleRemoveImage = (id: string) => {
    setPreviewImages((prev) => prev.filter((image) => image.id !== id));
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

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

  useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (roomId) {
        queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
        queryClient.invalidateQueries({ queryKey: ['chatRoom', roomId] });
      }
    };
  }, [queryClient, roomId]);

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
                  (
                  {(
                    ((image.originalSize - image.resizedSize) /
                      image.originalSize) *
                    100
                  ).toFixed(1)}
                  % 감소)
                </span>
              </div>
              <button
                onClick={() => handleRemoveImage(image.id)}
                className={styles.removeImageButton}
                aria-label="이미지 제거"
              >
                <CloseIcon width="8px" height="10px" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.chatContainer} ref={chatContainerRef}>
        {messages.map((message, index) => {
          if (message.type === 'ai') {
            return (
              <MarkdownChat
                key={index}
                markdown={message.content}
                isStreaming={message.isStreaming}
                isLoading={message.isLoading}
                image={currentRoom?.curatorInfo?.profileImage}
              />
            );
          } else if (message.type === 'user') {
            return (
              <QuestionBox
                key={index}
                type="user"
                content={message.content}
                imageUrls={message.imageUrls}
                imageSizeInfo={message.imageSizeInfo}
              />
            );
          }
          return null;
        })}
      </div>

      <SuggestedQuestions
        questions={suggestions.questions}
        onQuestionClick={handleSuggestionClick}
        visible={suggestions.visible}
      />

      <section
        ref={chatInputGroupRef}
        className={`${styles.chatInputGroup} ${isUploadMenuOpen ? styles.menuOpen : ''}`}
      >
        <FileUploadButton
          isOpen={isUploadMenuOpen}
          onToggle={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
          disabled={previewImages.length >= MAX_IMAGES}
        />
        <ChatInput
          onSendMessage={handleSendMessage}
          hasImage={previewImages.length > 0}
          disabled={messageCompleteRef.current === false}
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
              disabled={previewImages.length >= MAX_IMAGES}
            >
              <CameraIcon />
              카메라
            </button>
            <button
              onClick={handleAlbumSelect}
              className={styles.actionButton}
              disabled={previewImages.length >= MAX_IMAGES}
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
              multiple
            />
          </>
        ) : (
          <label
            htmlFor="fileInput"
            className={`${styles.fileInputLabel} ${previewImages.length >= MAX_IMAGES ? styles.disabled : ''}`}
          >
            <AlbumIcon />
            파일
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              id="fileInput"
              multiple
              disabled={previewImages.length >= MAX_IMAGES}
            />
          </label>
        )}
      </div>
      <SlideUpModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        navigationLink="/pricing"
        title="가지고 있는 스톤을 모두 사용했어요"
        content="더 대화를 나누기 위해서는 스톤 추가 구입이 필요해요."
      />
    </div>
  );
}

export default ChatDetail;
