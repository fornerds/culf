import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
  CButton,
  CSpinner,
  CBadge,
  CFormInput,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCommentSquare, cilTrash } from '@coreui/icons'
import httpClient from '../../api/httpClient'

const Conversations = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState([])

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await httpClient.get('/conversations', {
          params: {
            search_query: searchQuery
          }
        })
        setConversations(response.data)
      } catch (error) {
        console.error('Error fetching conversations:', error)
      }
    }

    fetchConversations()
  }, [searchQuery])

  const handleDelete = async (conversationId) => {
    if (window.confirm('정말 이 대화를 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/v1/admin/conversations/${conversationId}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          fetchConversations()
        }
      } catch (error) {
        console.error('Error deleting conversation:', error)
      }
    }
  }

  const truncateText = (text, maxLength = 50) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>채팅 내역 목록</strong>
          </CCardHeader>
          <CCardBody>
            <div className="mb-3">
              <CFormInput
                type="text"
                placeholder="사용자 닉네임으로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>사용자</CTableHeaderCell>
                  <CTableHeaderCell>큐레이터</CTableHeaderCell>
                  <CTableHeaderCell>마지막 메시지</CTableHeaderCell>
                  <CTableHeaderCell>시작 시간</CTableHeaderCell>
                  <CTableHeaderCell>종료 시간</CTableHeaderCell>
                  <CTableHeaderCell>상태</CTableHeaderCell>
                  <CTableHeaderCell>관리</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {conversations.map((conversation) => (
                  <CTableRow key={conversation.conversation_id}>
                    <CTableDataCell>{conversation.user_name}</CTableDataCell>
                    <CTableDataCell>{conversation.curator_name}</CTableDataCell>
                    <CTableDataCell>{truncateText(conversation.last_message)}</CTableDataCell>
                    <CTableDataCell>
                      {new Date(conversation.created_at).toLocaleString()}
                    </CTableDataCell>
                    <CTableDataCell>
                      {conversation.ended_at 
                        ? new Date(conversation.ended_at).toLocaleString() 
                        : '-'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={conversation.is_active ? 'success' : 'secondary'}>
                        {conversation.is_active ? '진행중' : '종료'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <Link to={`/conversations/${conversation.conversation_id}`}>
                        <CButton color="info" size="sm" className="me-2">
                          <CIcon icon={cilCommentSquare} />
                        </CButton>
                      </Link>
                      <CButton
                        color="danger"
                        size="sm"
                        onClick={() => handleDelete(conversation.conversation_id)}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Conversations
