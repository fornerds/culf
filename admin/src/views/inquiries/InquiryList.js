import React, { useState, useEffect } from 'react'
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
  CPagination,
  CPaginationItem,
  CFormSelect,
  CInputGroup,
  CFormInput,
  CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import httpClient from '../../api/httpClient'

const InquiryList = () => {
  const navigate = useNavigate()
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [status, setStatus] = useState('all')
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  })
  const limit = 10

  useEffect(() => {
    fetchInquiries()
  }, [currentPage, status, dateRange])

  const fetchInquiries = async () => {
    try {
      setLoading(true)
      const params = {
        skip: (currentPage - 1) * limit,
        limit,
        ...(status !== 'all' && { status }),
        ...(dateRange.startDate && { start_date: dateRange.startDate }),
        ...(dateRange.endDate && { end_date: dateRange.endDate })
      }
      
      const { data } = await httpClient.get('/admin/inquiries', { params })
      setInquiries(data)
      setTotalCount(data.length) // API가 total_count를 제공하면 그것을 사용
    } catch (error) {
      console.error('Error fetching inquiries:', error)
    } finally {
      setLoading(false)
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

  const handleStatusChange = async (inquiryId, newStatus) => {
    try {
      await httpClient.put(`/admin/inquiries/${inquiryId}/status`, {
        status: newStatus
      })
      fetchInquiries()
    } catch (error) {
      console.error('Error updating inquiry status:', error)
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
            <strong>문의사항 관리</strong>
          </CCardHeader>
          <CCardBody>
            <div className="mb-3">
              <CRow className="g-3">
                <CCol md={3}>
                  <CFormSelect
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">전체 상태</option>
                    <option value="PENDING">대기중</option>
                    <option value="RESOLVED">해결됨</option>
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CInputGroup>
                    <CFormInput
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                    <CInputGroupText>~</CInputGroupText>
                    <CFormInput
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </CInputGroup>
                </CCol>
              </CRow>
            </div>
            <CTable hover>
  <CTableHead>
    <CTableRow>
      <CTableHeaderCell>ID</CTableHeaderCell>
      <CTableHeaderCell>제목</CTableHeaderCell>
      <CTableHeaderCell>이메일</CTableHeaderCell>
      <CTableHeaderCell>연락처</CTableHeaderCell>
      <CTableHeaderCell>상태</CTableHeaderCell>
      <CTableHeaderCell>접수일</CTableHeaderCell>
      <CTableHeaderCell>상태 변경</CTableHeaderCell>
      <CTableHeaderCell>상세보기</CTableHeaderCell>
    </CTableRow>
  </CTableHead>
  <CTableBody>
    {inquiries.map((inquiry) => (
      <CTableRow key={inquiry.inquiry_id}>
        <CTableDataCell>{inquiry.inquiry_id}</CTableDataCell>
        <CTableDataCell>{inquiry.title}</CTableDataCell>
        <CTableDataCell>{inquiry.email}</CTableDataCell>
        <CTableDataCell>{inquiry.contact}</CTableDataCell>
        <CTableDataCell>{getStatusBadge(inquiry.status)}</CTableDataCell>
        <CTableDataCell>
          {format(new Date(inquiry.created_at), 'yyyy-MM-dd HH:mm')}
        </CTableDataCell>
        <CTableDataCell>
          <CFormSelect
            size="sm"
            style={{ width: '100px' }}
            value={inquiry.status}
            onChange={(e) => handleStatusChange(inquiry.inquiry_id, e.target.value)}
          >
            <option value="PENDING">대기중</option>
            <option value="RESOLVED">해결됨</option>
          </CFormSelect>
        </CTableDataCell>
        <CTableDataCell>
          <CButton
            color="primary"
            size="sm"
            onClick={() => navigate(`/inquiries/${inquiry.inquiry_id}`)}
          >
            상세보기
          </CButton>
        </CTableDataCell>
      </CTableRow>
    ))}
  </CTableBody>
</CTable>

            <CPagination align="center" aria-label="Page navigation">
              <CPaginationItem
                aria-label="Previous"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                <span aria-hidden="true">&laquo;</span>
              </CPaginationItem>
              {Array.from(
                { length: Math.min(5, Math.ceil(totalCount / limit)) },
                (_, i) => (
                  <CPaginationItem
                    key={i + 1}
                    active={currentPage === i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </CPaginationItem>
                )
              )}
              <CPaginationItem
                aria-label="Next"
                disabled={currentPage >= Math.ceil(totalCount / limit)}
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / limit), prev + 1))}
              >
                <span aria-hidden="true">&raquo;</span>
              </CPaginationItem>
            </CPagination>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default InquiryList