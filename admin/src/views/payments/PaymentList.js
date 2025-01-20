import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
    CFormInput,
    CInputGroup,
    CButtonGroup,
    CInputGroupText
} from '@coreui/react'
import { format } from 'date-fns'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilSearch } from '@coreui/icons'
import httpClient from '../../api/httpClient'

const PaymentList = () => {
    const navigate = useNavigate()
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [tempSearchQuery, setTempSearchQuery] = useState('')
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: '',
    })
    const [paymentMethod, setPaymentMethod] = useState('all')
    const [paymentStatus, setPaymentStatus] = useState('all')
    const limit = 10

    useEffect(() => {
        fetchPayments()
    }, [currentPage, searchQuery, dateRange, paymentMethod, paymentStatus])

    const fetchPayments = async () => {
        try {
            setLoading(true)
            const params = {
                page: currentPage,
                limit,
                query: searchQuery,
                ...(dateRange.startDate && { start_date: dateRange.startDate }),
                ...(dateRange.endDate && { end_date: dateRange.endDate }),
                ...(paymentMethod !== 'all' && { payment_method: paymentMethod }),
                ...(paymentStatus !== 'all' && { status: paymentStatus }),
            }

            const response = await httpClient.get('/admin/payments', { params })
            setPayments(response.data)
            // response 헤더에서 전체 개수를 가져옵니다
            const totalCount = parseInt(response.headers['x-total-count'] || '0')
            setTotalCount(totalCount)
        } catch (error) {
            console.error('Error fetching payments:', error)
            setPayments([])
            setTotalCount(0)
        } finally {
            setLoading(false)
        }
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

    const getStatusBadge = (status, refund) => {
        // 환불 상태 확인
        if (refund) {
            if (refund.status === 'APPROVED') {
                return <CBadge color="info">환불완료</CBadge>
            }
            if (refund.status === 'PENDING') {
                return <CBadge color="warning">환불대기</CBadge>
            }
        }

        // 결제 상태
        const statusMap = {
            SUCCESS: { color: 'success', label: '결제성공' },
            FAILED: { color: 'danger', label: '결제실패' },
            CANCELLED: { color: 'warning', label: '결제취소' },
            REFUNDED: { color: 'info', label: '환불완료' },
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

    return (
        <CRow>
            <CCol xs={12}>
                <CCard className="mb-4">
                    <CCardHeader className="d-flex justify-content-between align-items-center">
                        <strong>결제 관리</strong>
                        <CButton color="primary" onClick={() => navigate('/payments/create')}>
                            수동 결제 생성
                        </CButton>
                    </CCardHeader>
                    <CCardBody>
                        <div className="mb-3">
                            <CRow className="g-3">
                                <CCol md={3}>
                                    <CFormSelect
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <option value="all">전체 결제수단</option>
                                        <option value="kakaopay">카카오페이</option>
                                        <option value="manual">수동결제</option>
                                    </CFormSelect>
                                </CCol>
                                <CCol md={3}>
                                    <CFormSelect
                                        value={paymentStatus}
                                        onChange={(e) => setPaymentStatus(e.target.value)}
                                    >
                                        <option value="all">전체 상태</option>
                                        <option value="SUCCESS">성공</option>
                                        <option value="FAILED">실패</option>
                                        <option value="CANCELLED">취소</option>
                                        <option value="REFUNDED">환불</option>
                                    </CFormSelect>
                                </CCol>
                                <CCol md={4}>
                                    <CInputGroup>
                                        <CFormInput
                                            type="date"
                                            value={dateRange.startDate}
                                            onChange={(e) =>
                                                setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                                            }
                                        />
                                        <CInputGroupText>~</CInputGroupText>
                                        <CFormInput
                                            type="date"
                                            value={dateRange.endDate}
                                            onChange={(e) =>
                                                setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                                            }
                                        />
                                    </CInputGroup>
                                </CCol>
                                <CCol md={2}>
                                    <CInputGroup>
                                        <CFormInput
                                            placeholder="검색어 입력"
                                            value={tempSearchQuery}
                                            onChange={(e) => setTempSearchQuery(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                        />
                                        <CButton color="primary" onClick={handleSearch}>
                                            <CIcon icon={cilSearch} />
                                        </CButton>
                                    </CInputGroup>
                                </CCol>
                            </CRow>
                        </div>

                        <CTable hover>
                            <CTableHead>
                                <CTableRow>
                                    <CTableHeaderCell>결제번호</CTableHeaderCell>
                                    <CTableHeaderCell>사용자</CTableHeaderCell>
                                    <CTableHeaderCell>상품명</CTableHeaderCell>
                                    <CTableHeaderCell>금액</CTableHeaderCell>
                                    <CTableHeaderCell>결제수단</CTableHeaderCell>
                                    <CTableHeaderCell>상태</CTableHeaderCell>
                                    <CTableHeaderCell>결제일시</CTableHeaderCell>
                                    <CTableHeaderCell>관리</CTableHeaderCell>
                                </CTableRow>
                            </CTableHead>
                            <CTableBody>
                                {payments.map((payment) => (
                                    <CTableRow key={payment.payment_id}>
                                        <CTableDataCell>{payment.payment_number}</CTableDataCell>
                                        <CTableDataCell>{payment.user_nickname}</CTableDataCell>
                                        <CTableDataCell>{payment.product_name}</CTableDataCell>
                                        <CTableDataCell>{payment.amount.toLocaleString()}원</CTableDataCell>
                                        <CTableDataCell>{payment.payment_method}</CTableDataCell>
                                        <CTableDataCell>{getStatusBadge(payment.status, payment.refund)}</CTableDataCell>
                                        <CTableDataCell>
                                            {format(new Date(payment.payment_date), 'yyyy-MM-dd HH:mm')}
                                        </CTableDataCell>
                                        <CTableDataCell>
                                            <CButton
                                                color="info"
                                                size="sm"
                                                onClick={() => navigate(`/payments/${payment.payment_id}`)}
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
    )
}

export default PaymentList