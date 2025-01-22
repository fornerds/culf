import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CSpinner,
} from '@coreui/react';
import httpClient from '../../api/httpClient';

const ChatRoomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chatRoom, setChatRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    fetchChatRoomDetail();
  }, [id]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatRoom]);

  console.log('Current ID:', id); // ID 확인용 로그

  const fetchChatRoomDetail = async () => {
    try {
      const { data } = await httpClient.get(`/admin/chat-rooms/${id}`);
      setChatRoom(data);
    } catch (error) {
      console.error('Error fetching chat room details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <CSpinner color="primary" />
      </div>
    );
  }

  if (!chatRoom) {
    return <div>채팅방을 찾을 수 없습니다.</div>;
  }

  return (
    <CCard className="h-100">
      {/* 채팅방 헤더 */}
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <div>
          <div className="fw-bold fs-5">채팅방 상세</div>
          <div className="text-muted small">
            {chatRoom.curator_name} ↔ {chatRoom.user_name}
          </div>
        </div>
        <CButton 
          color="secondary" 
          size="sm"
          onClick={() => navigate('/conversations')}
        >
          목록으로
        </CButton>
      </CCardHeader>

      {/* 채팅방 정보 */}
      <div className="bg-light border-bottom p-3">
        <div className="row g-3">
          <div className="col-md-3">
            <div className="fw-bold">사용자</div>
            <div>{chatRoom.user_name}</div>
          </div>
          <div className="col-md-3">
            <div className="fw-bold">캐릭터</div>
            <div>{chatRoom.curator_name}</div>
          </div>
          <div className="col-md-3">
            <div className="fw-bold">시작 시간</div>
            <div>{new Date(chatRoom.created_at).toLocaleString()}</div>
          </div>
          <div className="col-md-3">
            <div className="fw-bold">마지막 채팅 시간</div>
            <div>{chatRoom.last_message_time ? 
                new Date(chatRoom.last_message_time).toLocaleString() : '-'}</div>
          </div>
        </div>
      </div>

      {/* 채팅 메시지 영역 */}
      <CCardBody 
        className="chat-container p-4" 
        ref={chatContainerRef}
        style={{ 
          height: 'calc(100vh - 300px)',
          overflowY: 'auto',
          backgroundColor: '#f8f9fa'
        }}
      >
        <div className="chat-messages">
          {chatRoom.messages.map((message, index) => (
            <div
              key={index}
              className={`chat-message d-flex mb-3 ${
                message.is_curator ? 'justify-content-end' : 'justify-content-start'
              }`}
            >
              {/* 프로필 이미지 (왼쪽) */}
              {!message.is_curator && (
                <div 
                  className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-2"
                  style={{ width: '40px', height: '40px', flexShrink: 0 }}
                >
                  {chatRoom.user_name.charAt(0)}
                </div>
              )}
              
              {/* 메시지 내용 */}
              <div style={{ maxWidth: '70%' }}>
                {/* 발신자 이름 */}
                <div className="small text-muted mb-1">
                  {message.is_curator ? chatRoom.curator_name : chatRoom.user_name}
                </div>
                
                {/* 메시지 버블 */}
                <div
                  className={`message-bubble p-3 rounded-3 ${
                    message.is_curator 
                      ? 'bg-primary text-white' 
                      : 'bg-white border'
                  }`}
                >
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {message.content}
                  </div>
                  <div className="small text-end mt-1">
                    <small className={message.is_curator ? 'text-white' : 'text-muted'}>
                      {new Date(message.created_at).toLocaleString()}
                    </small>
                  </div>
                </div>
              </div>
              
              {/* 프로필 이미지 (오른쪽) */}
              {message.is_curator && (
                <div 
                  className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center ms-2"
                  style={{ width: '40px', height: '40px', flexShrink: 0 }}
                >
                  {chatRoom.curator_name.charAt(0)}
                </div>
              )}
            </div>
          ))}
        </div>
      </CCardBody>
    </CCard>
  );
};

export default ChatRoomDetail;