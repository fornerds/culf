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
  CFormSelect,
  CListGroup,
  CListGroupItem,
  CImage,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CBadge,
} from '@coreui/react'
import { format } from 'date-fns'
import httpClient from '../../api/httpClient'

const InquiryDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [inquiry, setInquiry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showStatusModal, setShowStatusModal] = useState(false)

  useEffect(() => {
    fetchInquiryDetail()
  }, [id])

  const fetchInquiryDetail = async () => {
    try {
      setLoading(true)
      const { data } = await httpClient.get(`/admin/inquiries/${id}`)
      setInquiry(data)
    } catch (error) {
      console.error('Error fetching inquiry details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async () => {
    try {
      await httpClient.put(`/admin/inquiries/${id}/status`, {
        status: 'RESOLVED'
      })
      setShowStatusModal(false)
      await fetchInquiryDetail()
    } catch (error) {
      console.error('Error updating inquiry status:', error)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: { color: 'warning', label: '대기중' },
      RESOLVED: { color: 'success', label: '해결됨' }
    }
    const statusInfo = statusMap[status] || { color: 'secondary', label: '알 수 없음' }
    return <CBadge color={statusInfo.color}>{statusInfo.label}</CBadge>
  }

  if (loading) {
    return (
      <div className="text-center">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (!inquiry) {
    return <div>문의사항을 찾을 수 없습니다.</div>
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <strong>문의사항 상세</strong>
            <div>
              {inquiry.status === 'PENDING' && (
                <CButton
                  color="primary"
                  size="sm"
                  onClick={() => setShowStatusModal(true)}
                  className="me-2"
                >
                  해결 처리
                </CButton>
              )}
              <CButton
                color="secondary"
                size="sm"
                onClick={() => navigate('/inquiries')}
              >
                목록으로
              </CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CListGroup>
              <CListGroupItem>
                <div className="fw-bold">상태</div>
                {getStatusBadge(inquiry.status)}
              </CListGroupItem>
              <CListGroupItem>
                <div className="fw-bold">제목</div>
                {inquiry.title}
              </CListGroupItem>
              <CListGroupItem>
                <div className="fw-bold">문의 이메일</div>
                {inquiry.email}
              </CListGroupItem>
              <CListGroupItem>
                <div className="fw-bold">문의 연락처</div>
                {inquiry.contact}
              </CListGroupItem>
              <CListGroupItem>
                <div className="fw-bold">가입 이메일</div>
                {inquiry.user ? inquiry.user.email : '비회원'}
              </CListGroupItem>
              <CListGroupItem>
                <div className="fw-bold">가입 연락처</div>
                {inquiry.user ? (inquiry.user.phone_number || '미등록') : '비회원'}
              </CListGroupItem>
              <CListGroupItem>
                <div className="fw-bold">접수일시</div>
                {format(new Date(inquiry.created_at), 'yyyy-MM-dd HH:mm:ss')}
              </CListGroupItem>
              <CListGroupItem>
                <div className="fw-bold">내용</div>
                <div className="mt-2" style={{ whiteSpace: 'pre-wrap' }}>
                  {inquiry.content}
                </div>
              </CListGroupItem>
              {inquiry.attachments && inquiry.attachments.length > 0 && (
                <CListGroupItem>
                  <div className="fw-bold mb-2">첨부파일</div>
                  <div className="d-flex flex-wrap gap-3">
                    {inquiry.attachments.map((imageUrl, index) => (
                      <div key={index} className="text-center">
                        <CImage
                          src={imageUrl}
                          alt={`첨부이미지 ${index + 1}`}
                          style={{ maxWidth: '200px', maxHeight: '200px' }}
                          className="mb-1"
                        />
                        <div className="small">
                          <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                            원본 다운로드
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </CListGroupItem>
              )}
            </CListGroup>
          </CCardBody>
        </CCard>
      </CCol>

      <CModal
        visible={showStatusModal}
        onClose={() => setShowStatusModal(false)}
      >
        <CModalHeader>
          <CModalTitle>문의사항 상태 변경</CModalTitle>
        </CModalHeader>
        <CModalBody>
          이 문의사항을 해결 처리하시겠습니까?
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowStatusModal(false)}
          >
            취소
          </CButton>
          <CButton
            color="primary"
            onClick={handleStatusChange}
          >
            확인
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}

export default InquiryDetail