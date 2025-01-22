import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CSpinner,
  CListGroup,
  CListGroupItem,
} from '@coreui/react'

const ConversationDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversationDetail()
  }, [id])

  const fetchConversationDetail = async () => {
    try {
      const response = await fetch(`/v1/admin/conversations/${id}`)
      if (response.ok) {
        const data = await response.json()
        setConversation(data)
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error)
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

  if (!conversation) {
    return <div>대화를 찾을 수 없습니다.</div>
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>대화 상세 내역</strong>
          </CCardHeader>
          <CCardBody>
            <div className="mb-4">
              <h5>대화 정보</h5>
              <CListGroup className="mb-3">
                <CListGroupItem>
                  <div className="fw-bold">사용자</div>
                  {conversation.user_name}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">캐릭터</div>
                  {conversation.curator_name}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">시작 시간</div>
                  {new Date(conversation.created_at).toLocaleString()}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">종료 시간</div>
                  {conversation.ended_at 
                    ? new Date(conversation.ended_at).toLocaleString() 
                    : '진행중'}
                </CListGroupItem>
              </CListGroup>

              <h5>메시지 내역</h5>
              <CListGroup>
                {conversation.messages.map((message, index) => (
                  <CListGroupItem 
                    key={index}
                    className={`mb-2 ${
                      message.is_curator ? 'bg-light' : ''
                    }`}
                  >
                    <div className="d-flex justify-content-between">
                      <small className="text-muted">
                        {message.is_curator ? '캐릭터' : '사용자'}
                      </small>
                      <small className="text-muted">
                        {new Date(message.created_at).toLocaleString()}
                      </small>
                    </div>
                    <div className="mt-2">{message.content}</div>
                  </CListGroupItem>
                ))}
              </CListGroup>
            </div>
            <CButton 
              color="secondary" 
              onClick={() => navigate('/conversations')}
            >
              목록으로 돌아가기
            </CButton>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default ConversationDetail
