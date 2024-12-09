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