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
  CBadge,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { format } from 'date-fns'
import httpClient from '../../api/httpClient'

const PaymentDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPaymentDetail()
  }, [id])

  const fetchPaymentDetail = async () => {
    try {
      setLoading(true)
      const { data } = await httpClient.get(`/admin/payments/${id}`)
      setPayment(data)
    } catch (error) {
      console.error('Error fetching payment details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      SUCCESS: { color: 'success', label: '성공' },
      FAILED: { color: 'danger', label: '실패' },
      CANCELLED: { color: 'warning', label: '취소' },
      REFUNDED: { color: 'info', label: '환불' },
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

  if (!payment) {
    return <div>결제 정보를 찾을 수 없습니다.</div>
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center">
  <strong>결제 상세 정보</strong>
  <div>
    {(payment.status === 'SUCCESS' && !payment.refund) || 
     (payment.refund && payment.refund.status === 'PENDING') ? (
      <CButton
        color="danger"
        variant="outline"
        size="sm"
        onClick={() => navigate(`/payments/${payment.payment_id}/refund`)}
        className="me-2"
      >
        {payment.refund?.status === 'PENDING' ? '환불 처리' : '환불'}
      </CButton>
    ) : null}
    <CButton
      color="secondary"
      size="sm"
      onClick={() => navigate('/payments')}
    >
      목록으로
    </CButton>
  </div>
</CCardHeader>
          <CCardBody>
            <div className="mb-4">
              <h5>결제 정보</h5>
              <CListGroup>
                <CListGroupItem>
                  <div className="fw-bold">결제 번호</div>
                  {payment.payment_number}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">거래 번호</div>
                  {payment.transaction_number || '-'}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">결제자</div>
                  {payment.user_nickname}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">결제 금액</div>
                  {payment.amount.toLocaleString()}원
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">결제 수단</div>
                  {payment.payment_method}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">결제 상태</div>
                  {getStatusBadge(payment.status)}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">결제 일시</div>
                  {format(new Date(payment.payment_date), 'yyyy-MM-dd HH:mm:ss')}
                </CListGroupItem>
              </CListGroup>
            </div>

            {payment.refund && (
              <div className="mb-4">
                <h5>환불 정보</h5>
                <CListGroup>
                  <CListGroupItem>
                    <div className="fw-bold">환불 번호</div>
                    {payment.refund.refund_id}
                  </CListGroupItem>
                  <CListGroupItem>
                    <div className="fw-bold">환불 금액</div>
                    {payment.refund.amount.toLocaleString()}원
                  </CListGroupItem>
                  <CListGroupItem>
                    <div className="fw-bold">환불 사유</div>
                    {payment.refund.reason}
                  </CListGroupItem>
                  <CListGroupItem>
                    <div className="fw-bold">처리 상태</div>
                    <CBadge color={payment.refund.status === 'APPROVED' ? 'success' : 'warning'}>
                      {payment.refund.status === 'APPROVED' ? '승인' : '대기중'}
                    </CBadge>
                  </CListGroupItem>
                  <CListGroupItem>
                    <div className="fw-bold">처리 일시</div>
                    {payment.refund.processed_at
                      ? format(new Date(payment.refund.processed_at), 'yyyy-MM-dd HH:mm:ss')
                      : '-'}
                  </CListGroupItem>
                </CListGroup>
              </div>
            )}

            {payment.inquiries && payment.inquiries.length > 0 && (
              <div className="mb-4">
                <h5>관련 문의</h5>
                <CTable small>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>문의 번호</CTableHeaderCell>
                      <CTableHeaderCell>제목</CTableHeaderCell>
                      <CTableHeaderCell>상태</CTableHeaderCell>
                      <CTableHeaderCell>접수일시</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {payment.inquiries.map((inquiry) => (
                      <CTableRow key={inquiry.inquiry_id}>
                        <CTableDataCell>{inquiry.inquiry_id}</CTableDataCell>
                        <CTableDataCell>{inquiry.title}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={inquiry.status === 'RESOLVED' ? 'success' : 'warning'}>
                            {inquiry.status === 'RESOLVED' ? '해결' : '대기중'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          {format(new Date(inquiry.created_at), 'yyyy-MM-dd HH:mm')}
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default PaymentDetail