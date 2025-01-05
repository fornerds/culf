import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
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
    CPagination,
    CPaginationItem,
    CModal,
    CModalHeader,
    CModalTitle,
    CModalBody,
    CButton,
    CFormSelect,
    CInputGroup,
    CFormInput,
    CSpinner,
} from '@coreui/react'
import { format } from 'date-fns'
import httpClient from '../../api/httpClient'
import { cilCloudDownload } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver';

const ConversationList = () => {
    const [conversations, setConversations] = useState([])
    const [totalCount, setTotalCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedAnswer, setSelectedAnswer] = useState(null)
    const [visible, setVisible] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [tempSearchQuery, setTempSearchQuery] = useState('')
    const [users, setUsers] = useState([])
    const [selectedUser, setSelectedUser] = useState('all')
    const [loading, setLoading] = useState(true)
    const limit = 10

    const isDarkMode = useSelector((state) => state.theme?.darkMode)

    useEffect(() => {
        fetchConversations()
    }, [currentPage, searchQuery])

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const response = await httpClient.get('/users')
            setUsers(response.data.users)
        } catch (error) {
            console.error('Error fetching users:', error)
        }
    }

    const fetchConversations = async () => {
        try {
            setLoading(true)
            let url = `/conversations?page=${currentPage}&limit=${limit}`
            if (searchQuery) {
                url += `&search_query=${encodeURIComponent(searchQuery)}`
            }

            const response = await httpClient.get(url)
            const data = response.data
            
            if (data && data.conversations) {
                setConversations(data.conversations)
                setTotalCount(data.total_count || 0)
            } else {
                console.error('Invalid response format:', data)
            }
        } catch (error) {
            console.error('Error fetching conversations:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleUserChange = (event) => {
        setSelectedUser(event.target.value)
        setCurrentPage(1)
    }
    
    const handleResetFilter = () => {
        setSelectedUser('all')
        setCurrentPage(1)
    }

    const formatDateTime = (dateTimeStr) => {
        return format(new Date(dateTimeStr), 'yyyy-MM-dd HH:mm:ss')
    }

    const handleAnswerClick = (answer) => {
        setSelectedAnswer(answer)
        setVisible(true)
    }

    const handleInputChange = (event) => {
        setTempSearchQuery(event.target.value)
    }

    const handleSearch = () => {
        setSearchQuery(tempSearchQuery)
        setCurrentPage(1)
    }

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            handleSearch()
        }
    }
    
// 전체 대화 내용을 가져오는 함수 추가
const fetchAllConversations = async () => {
    try {
      const response = await httpClient.get('/conversations', {
        params: {
          limit: 999999,  // 또는 매우 큰 숫자
          page: 1,
          search_query: searchQuery
        }
      })
      
      if (response.data && response.data.conversations) {
        return response.data.conversations
      }
      return []
    } catch (error) {
      console.error('Error fetching all conversations:', error)
      return []
    }
  }
  
  // 엑셀 다운로드 함수 수정
  const handleExportExcel = async () => {
    // 데이터 가져오기 전 로딩 표시
    setLoading(true)
    
    try {
      // 전체 대화 내용 가져오기
      const allConversations = await fetchAllConversations()
      
      // 엑셀로 변환할 데이터 준비
      const exportData = allConversations.map(conv => ({
        '사용자': conv.user_nickname,
        '질문': conv.question,
        '답변': conv.answer,
        '질문 시간': format(new Date(conv.question_time), 'yyyy-MM-dd HH:mm:ss'),
        '토큰 사용량': conv.tokens_used
      }))
  
      // 워크북 생성
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)
  
      // 열 너비 자동 조정
      const maxWidth = 50
      const wscols = [
        { wch: 15 }, // 사용자
        { wch: 30 }, // 질문
        { wch: maxWidth }, // 답변
        { wch: 20 }, // 질문 시간
        { wch: 12 }  // 토큰 사용량
      ]
      ws['!cols'] = wscols
  
      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(wb, ws, '대화내역')
  
      // 파일 저장
      const fileName = `대화내역_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, fileName);
    } catch (error) {
      console.error('Error exporting conversations:', error)
    } finally {
      setLoading(false)
    }
  }

    if (loading) {
        return (
            <div className="text-center">
                <CSpinner color="primary" />
            </div>
        )
    }

    return (
        <CRow>
            <CCol xs={12}>
                <CCard className="mb-4">
                <CCardHeader className="d-flex justify-content-between align-items-center">
  <strong>대화 내역</strong>
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
                        <div className="mb-3 d-flex justify-content-end">
                            <CInputGroup style={{ width: 'auto' }}>
                                <CFormInput
                                    type="text"
                                    placeholder="사용자 닉네임으로 검색"
                                    value={tempSearchQuery}
                                    onChange={handleInputChange}
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
                        <CTable hover>
                            <CTableHead>
                                <CTableRow>
                                    <CTableHeaderCell style={{ width: '5%' }}>사용자</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '12%' }}>질문</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '50%' }}>답변</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '8%' }}>질문 시간</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '7%' }}>토큰 사용량</CTableHeaderCell>
                                </CTableRow>
                            </CTableHead>
                            <CTableBody>
                                {conversations.map((conversation) => (
                                    <CTableRow key={conversation.conversation_id}>
                                        <CTableDataCell>{conversation.user_nickname}</CTableDataCell>
                                        <CTableDataCell>{conversation.question}</CTableDataCell>
                                        <CTableDataCell>
                                            <CButton
                                                color="link"
                                                onClick={() => handleAnswerClick(conversation.answer)}
                                                style={{ textDecoration: 'none' }}
                                            >
                                                {conversation.answer.length > 100
                                                    ? `${conversation.answer.substring(0, 100)}...`
                                                    : conversation.answer}
                                            </CButton>
                                        </CTableDataCell>
                                        <CTableDataCell>{formatDateTime(conversation.question_time)}</CTableDataCell>
                                        <CTableDataCell>{conversation.tokens_used}</CTableDataCell>
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
    <span aria-hidden="true">&lt;</span>
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
    <span aria-hidden="true">&rt;</span>
  </CPaginationItem>
</CPagination>
                        <CModal
                            visible={visible}
                            onClose={() => setVisible(false)}
                            size="lg"
                            scrollable
                        >
                            <CModalHeader onClose={() => setVisible(false)}>
                                <CModalTitle>답변 전체 내용</CModalTitle>
                            </CModalHeader>
                            <CModalBody>
                                <div style={{
                                    whiteSpace: 'pre-wrap',
                                    padding: '1rem',
                                    backgroundColor: isDarkMode ? '#2c2c34' : '#f8f9fa',
                                    color: isDarkMode ? '#fff' : '#000',
                                    borderRadius: '0.25rem',
                                    fontSize: '1rem',
                                    lineHeight: '1.5'
                                }}>
                                    {selectedAnswer}
                                </div>
                            </CModalBody>
                        </CModal>
                    </CCardBody>
                </CCard>
            </CCol>
        </CRow>
    )
}

export default ConversationList