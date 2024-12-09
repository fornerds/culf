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
} from '@coreui/react'
import { format } from 'date-fns'

const ConversationList = () => {
    const [conversations, setConversations] = useState([])
    const [totalCount, setTotalCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedAnswer, setSelectedAnswer] = useState(null)
    const [visible, setVisible] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [tempSearchQuery, setTempSearchQuery] = useState('')
    const [users, setUsers] = useState([]) // 사용자 목록
    const [selectedUser, setSelectedUser] = useState('all') // 선택된 사용자
    const limit = 10

    // 현재 테마 상태 가져오기
    const isDarkMode = useSelector((state) => state.theme?.darkMode)

    useEffect(() => {
        console.log('Effect triggered with searchQuery:', searchQuery)
        fetchConversations()
    }, [currentPage, searchQuery])

    useEffect(() => {
    fetchUsers() // 컴포넌트 마운트 시 사용자 목록 가져오기
    }, [])

    const fetchUsers = async () => {
    try {
        const response = await fetch('http://localhost:8000/v1/users')
        const data = await response.json()
        setUsers(data.users)
    } catch (error) {
        console.error('Error fetching users:', error)
    }
    }

    const fetchConversations = async () => {
        try {
            let url = `http://localhost:8000/v1/conversations?page=${currentPage}&limit=${limit}`
            if (searchQuery) {
                url += `&search_query=${encodeURIComponent(searchQuery)}`
            }

            console.log('Fetching URL:', url)

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })
            const data = await response.json()
            
            console.log('Search Response:', data)
            
            if (data && data.conversations) {
                setConversations(data.conversations)
                setTotalCount(data.total_count || 0)
            } else {
                console.error('Invalid response format:', data)
            }
        } catch (error) {
            console.error('Error fetching conversations:', error)
        }
    }

    const handleUserChange = (event) => {
        setSelectedUser(event.target.value)
        setCurrentPage(1) // 사용자 변경 시 첫 페이지로 이동
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
        console.log('Searching for:', tempSearchQuery)
        setSearchQuery(tempSearchQuery)
        setCurrentPage(1)
    }

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            handleSearch()
        }
    }

    return (
        <CRow>
            <CCol xs={12}>
                <CCard className="mb-4">
                    <CCardHeader>
                        <strong>대화 내역</strong>
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
                            {[...Array(Math.ceil(totalCount / limit))].map((_, index) => (
                                <CPaginationItem
                                    key={index + 1}
                                    active={currentPage === index + 1}
                                    onClick={() => setCurrentPage(index + 1)}
                                >
                                    {index + 1}
                                </CPaginationItem>
                            ))}
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
