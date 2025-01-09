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
  CButton,
} from '@coreui/react';
import { cilCloudDownload } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver';
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

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      // 관리자용 엔드포인트로 변경
      const { data } = await httpClient.get('/admin/conversations', {
        params: {
          limit: 999999,
          page: 1,
          search_query: ''
        }
      });
  
      // 엑셀로 변환할 데이터 준비 (큐레이터 정보와 태그 포함)
      const exportData = data.conversations.map(conv => ({
        '사용자': conv.user_nickname,
        '큐레이터': conv.curator?.name || '',
        '큐레이터 태그': conv.curator_tags?.join(', ') || '',
        '질문': conv.question,
        '답변': conv.answer,
        '질문 시간': new Date(conv.question_time).toLocaleString(),
        '토큰 사용량': conv.tokens_used
      }));
  
      // 워크북 생성
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
  
      // 열 너비 자동 조정
      const maxWidth = 50;
      const wscols = [
        { wch: 15 }, // 사용자
        { wch: 15 }, // 큐레이터
        { wch: 20 }, // 큐레이터 태그
        { wch: 30 }, // 질문
        { wch: maxWidth }, // 답변
        { wch: 20 }, // 질문 시간
        { wch: 12 }  // 토큰 사용량
      ];
      ws['!cols'] = wscols;
  
      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(wb, ws, '대화내역');
  
      // 파일 저장
      const fileName = `대화내역_${new Date().toISOString().split('T')[0]}.xlsx`;
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);
  
    } catch (error) {
      console.error('Error exporting conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader className="d-flex justify-content-between align-items-center">
              <strong>채팅방 목록</strong>
              <CButton 
                color="primary"
                size="sm"
                onClick={handleExportExcel}
              >
                <CIcon icon={cilCloudDownload} className="me-2" />
                대화내용 내보내기
              </CButton>
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
                    onClick={() => navigate(`/conversations/${room.room_id}`)}
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
                      {new Date(room.last_message_time).toLocaleString()}
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