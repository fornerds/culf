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
  CTooltip,
  CWidgetStatsF,
} from '@coreui/react';
import { cilCloudDownload, cilChatBubble } from '@coreui/icons';
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
  const [tokenStats, setTokenStats] = useState({
    averageTokens: 0,
    totalRooms: 0,
    totalTokens: 0,
  });
  const navigate = useNavigate();
  const limit = 10;

  useEffect(() => {
    fetchChatRooms();
  }, [currentPage, searchQuery]);

  const calculateTokenStats = (rooms) => {
    const validRooms = rooms.filter(room => room.average_tokens_per_conversation);
    const averageTokens = validRooms.length > 0
      ? validRooms.reduce((sum, room) => sum + parseFloat(room.average_tokens_per_conversation), 0) / validRooms.length
      : 0;

    const totalTokens = rooms.reduce((sum, room) => sum + (room.total_tokens_used || 0), 0);

    setTokenStats({
      averageTokens: parseFloat(averageTokens.toFixed(1)),
      totalRooms: rooms.length,
      totalTokens,
    });
  };

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
      calculateTokenStats(data.chat_rooms);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleExportExcel = async () => {
    setLoading(true);
    try {
      const allChatRooms = await fetchAllChatRooms();

      const exportData = allChatRooms.map(room => ({
        '사용자': room.user_name,
        '캐릭터': room.curator_name,
        '캐릭터 태그': room.curator_tags?.join(', ') || '',
        '시작 시간': new Date(room.created_at).toLocaleString(),
        '대화 요약': room.title || '요약 없음',
        '마지막 채팅 시간': new Date(room.last_message_time).toLocaleString(),
        '메시지 수': room.message_count,
        '총 토큰 사용량': room.total_tokens_used?.toLocaleString() || '0',
        '평균 토큰 사용량': room.average_tokens_per_conversation?.toFixed(1) || '0',
        '상태': room.is_active ? '활성' : '삭제됨'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const wscols = [
        { wch: 15 }, // 사용자
        { wch: 15 }, // 캐릭터
        { wch: 30 }, // 캐릭터 태그
        { wch: 20 }, // 시작 시간
        { wch: 50 }, // 마지막 메시지
        { wch: 20 }, // 마지막 채팅 시간
        { wch: 10 }, // 메시지 수
        { wch: 15 }, // 총 스톤 사용량
        { wch: 15 }  // 평균 스톤 사용량
      ];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, '채팅방목록');
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
                  <CTableHeaderCell style={{ width: '7%' }}>캐릭터</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '12%' }}>캐릭터 태그</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '13%' }}>시작 시간</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '20%' }}>대화 요약</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '13%' }}>마지막 채팅 시간</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '7%' }}>메시지 수</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '9%' }}>
                    <CTooltip content="대화당 평균 토큰 사용량">
                      <span>평균 토큰</span>
                    </CTooltip>
                  </CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '9%' }}>
                    <CTooltip content="총 토큰 사용량">
                      <span>총 토큰</span>
                    </CTooltip>
                  </CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '7%' }}>상태</CTableHeaderCell>
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
                      {room.title || '제목 없음'}
                    </CTableDataCell>
                    <CTableDataCell>
                      {new Date(room.last_message_time).toLocaleString()}
                    </CTableDataCell>
                    <CTableDataCell>
                      {room.message_count}
                    </CTableDataCell>
                    <CTableDataCell>
                      {room.average_tokens_per_conversation
                        ? room.average_tokens_per_conversation.toFixed(1)
                        : '-'
                      }
                    </CTableDataCell>
                    <CTableDataCell>
                      {room.total_tokens_used?.toLocaleString() || '-'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={room.is_active ? 'danger' : 'success'}>
                        {room.is_active ? '삭제됨' : '활성'}
                      </CBadge>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
            <CPagination align="center" aria-label="Page navigation">
              <CPaginationItem
                aria-label="Previous"
                disabled={currentPage <= 10}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 10))}
              >
                <span aria-hidden="true">&lt;</span>
              </CPaginationItem>

              {Array.from(
                { length: 10 },
                (_, i) => {
                  const pageNum = Math.floor((currentPage - 1) / 10) * 10 + i + 1;
                  return pageNum <= Math.ceil(totalCount / limit) ? (
                    <CPaginationItem
                      key={i}
                      active={currentPage === pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </CPaginationItem>
                  ) : null;
                }
              )}

              <CPaginationItem
                aria-label="Next"
                disabled={Math.floor((currentPage - 1) / 10) * 10 + 11 > Math.ceil(totalCount / limit)}
                onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / limit), Math.floor((currentPage - 1) / 10) * 10 + 11))}
              >
                <span aria-hidden="true">&gt;</span>
              </CPaginationItem>
            </CPagination>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default ChatRoomList;