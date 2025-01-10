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
  CInputGroup,
  CFormInput,
  CButton,
  CPagination,
  CPaginationItem,
} from '@coreui/react';
import { cilCloudDownload } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import httpClient from '../../api/httpClient';

const ChatRoomList = () => {
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const navigate = useNavigate();
  const limit = 10;

  useEffect(() => {
    fetchChatRooms();
  }, [currentPage, searchQuery]);

  const fetchChatRooms = async () => {
    try {
      setLoading(true);
      let url = `/admin/chat-rooms?page=${currentPage}&limit=${limit}`;
      if (searchQuery) {
        url += `&search_query=${encodeURIComponent(searchQuery)}`;
      }
      
      const { data } = await httpClient.get(url);
      setChatRooms(data.chat_rooms);
      setTotalCount(data.total_count || 0);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // 전체 채팅방 데이터 가져오기
  const fetchAllChatRooms = async () => {
    try {
      const response = await httpClient.get('/admin/chat-rooms', {
        params: {
          limit: 999999,
          page: 1,
          search_query: searchQuery
        }
      });
      return response.data.chat_rooms || [];
    } catch (error) {
      console.error('Error fetching all chat rooms:', error);
      return [];
    }
  };

  // 엑셀 다운로드 처리
  const handleExportExcel = async () => {
    setLoading(true);
    try {
      const allChatRooms = await fetchAllChatRooms();
      
      // 엑셀 데이터 준비
      const exportData = allChatRooms.map(room => ({
        '사용자': room.user_name,
        '큐레이터': room.curator_name,
        '큐레이터 태그': room.curator_tags?.join(', ') || '',
        '시작 시간': new Date(room.created_at).toLocaleString(),
        '마지막 메시지': room.last_message,
        '마지막 채팅 시간': new Date(room.last_message_time).toLocaleString(),
        '메시지 수': room.message_count
      }));

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // 열 너비 설정
      const wscols = [
        { wch: 15 }, // 사용자
        { wch: 15 }, // 큐레이터
        { wch: 30 }, // 큐레이터 태그
        { wch: 20 }, // 시작 시간
        { wch: 50 }, // 마지막 메시지
        { wch: 20 }, // 마지막 채팅 시간
        { wch: 10 }  // 메시지 수
      ];
      ws['!cols'] = wscols;

      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(wb, ws, '채팅방목록');

      // 파일 저장
      const fileName = `채팅방목록_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, fileName);
    } catch (error) {
      console.error('Error exporting chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(tempSearchQuery);
    setCurrentPage(1);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
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
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <strong>채팅방 목록</strong>
            <CButton 
              color="primary"
              size="sm"
              onClick={handleExportExcel}
            >
              <CIcon icon={cilCloudDownload} className="me-2" />
              채팅내용 내보내기
            </CButton>
          </CCardHeader>
          <CCardBody>
            <div className="mb-3 d-flex justify-content-end">
              <CInputGroup style={{ width: 'auto' }}>
                <CFormInput
                  type="text"
                  placeholder="사용자 닉네임으로 검색"
                  value={tempSearchQuery}
                  onChange={(e) => setTempSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  style={{ maxWidth: '200px' }}
                />
                <CButton 
                  color="primary"
                  onClick={handleSearch}
                >
                  검색
                </CButton>
              </CInputGroup>
            </div>

            <CTable hover align="middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '10%' }}>사용자</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '7%' }}>큐레이터</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '12%' }}>큐레이터 태그</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '16%' }}>시작 시간</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '20%' }}>마지막 메시지</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '16%' }}>마지막 채팅 시간</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '7%' }}>메시지 수</CTableHeaderCell>
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
                      {new Date(room.last_message_time).toLocaleString()}
                    </CTableDataCell>
                    <CTableDataCell>
                      {room.message_count}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>

            <CPagination align="center" aria-label="Page navigation">
              <CPaginationItem 
                aria-label="이전"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 10))}
                disabled={currentPage <= 1}
              >
                <span aria-hidden="true">이전</span>
              </CPaginationItem>

              {[...Array(10)].map((_, index) => {
                const pageNum = Math.floor((currentPage - 1) / 10) * 10 + index + 1;
                if (pageNum <= Math.ceil(totalCount / limit)) {
                  return (
                    <CPaginationItem
                      key={pageNum}
                      active={currentPage === pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </CPaginationItem>
                  );
                }
                return null;
              })}

              <CPaginationItem
                aria-label="다음"
                onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / limit), currentPage + 10))}
                disabled={currentPage > Math.ceil(totalCount / limit) - 10}
              >
                <span aria-hidden="true">다음</span>
              </CPaginationItem>
            </CPagination>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default ChatRoomList;