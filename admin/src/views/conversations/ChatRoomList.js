import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CSpinner,
  CBadge,
} from '@coreui/react';
import httpClient from '../../api/httpClient';

const ChatRoomList = () => {
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChatRooms();
  }, []);

  const fetchChatRooms = async () => {
    try {
      setLoading(true);
      const { data } = await httpClient.get('/admin/chat-rooms');
      setChatRooms(data.chat_rooms);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastChatTime = (time) => {
    const date = new Date(time);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return '어제';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <CSpinner color="primary" />
      </div>
    );
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>채팅방 목록</strong>
          </CCardHeader>
          <CCardBody>
            <CTable hover align="middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>사용자</CTableHeaderCell>
                  <CTableHeaderCell>큐레이터</CTableHeaderCell>
                  <CTableHeaderCell>큐레이터 태그</CTableHeaderCell>
                  <CTableHeaderCell>시작 시간</CTableHeaderCell>
                  <CTableHeaderCell>마지막 메시지</CTableHeaderCell>
                  <CTableHeaderCell>마지막 채팅 시간</CTableHeaderCell>
                  <CTableHeaderCell>메시지 수</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {chatRooms.map((room) => (
                  <CTableRow 
                    key={room.room_id} 
                    onClick={() => navigate(`/admin/chat-rooms/${room.room_id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <CTableDataCell>{room.user_name}</CTableDataCell>
                    <CTableDataCell>{room.curator_name}</CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex gap-1 flex-wrap">
                        {room.curator_tags?.map((tag, index) => (
                          <CBadge 
                            key={index} 
                            color="info" 
                            className="text-white"
                            style={{ fontSize: '0.8rem' }}
                          >
                            {tag}
                          </CBadge>
                        ))}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {new Date(room.created_at).toLocaleString()}
                    </CTableDataCell>
                    <CTableDataCell>
                      {room.last_message && room.last_message.length > 30
                        ? `${room.last_message.substring(0, 30)}...`
                        : room.last_message}
                    </CTableDataCell>
                    <CTableDataCell>
                      {formatLastChatTime(room.last_message_time)}
                    </CTableDataCell>
                    <CTableDataCell>
                      {room.message_count}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default ChatRoomList;