// NoticeList.js
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
  CFormInput,
  CInputGroup,
} from '@coreui/react'
import { cilSearch } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { format } from 'date-fns'
import httpClient from '../../api/httpClient'

const NoticeList = () => {
  const navigate = useNavigate()
  const [notices, setNotices] = useState([])  // 빈 배열로 초기화
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [tempSearchQuery, setTempSearchQuery] = useState('')
  const limit = 10

  useEffect(() => {
    fetchNotices()
  }, [currentPage, searchQuery])

  const fetchNotices = async () => {
    try {
      setLoading(true)
      const { data } = await httpClient.get('/admin/notices', {
        params: {
          page: currentPage,
          limit,
          search: searchQuery
        }
      })
      
      // data.notices가 있으면 그것을 사용하고, 없으면 data 자체가 배열일 경우 그것을 사용
      setNotices(Array.isArray(data.notices) ? data.notices : (Array.isArray(data) ? data : []))
      setTotalCount(data.total_count || 0)
    } catch (error) {
      console.error('Error fetching notices:', error)
      setNotices([])  // 에러 시 빈 배열로 설정
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

  const handleDelete = async (noticeId) => {
    if (window.confirm('이 공지사항을 삭제하시겠습니까?')) {
      try {
        await httpClient.delete(`/admin/notices/${noticeId}`)
        fetchNotices()
      } catch (error) {
        console.error('Error deleting notice:', error)
      }
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
            <strong>공지사항 관리</strong>
            <CButton
              color="primary"
              onClick={() => navigate('/notices/create')}
            >
              공지사항 작성
            </CButton>
          </CCardHeader>
          <CCardBody>
            <div className="mb-3 d-flex justify-content-end">
              <CInputGroup style={{ width: '300px' }}>
                <CFormInput
                  placeholder="제목으로 검색"
                  value={tempSearchQuery}
                  onChange={(e) => setTempSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <CButton
                  color="primary"
                  variant="outline"
                  onClick={handleSearch}
                >
                  <CIcon icon={cilSearch} />
                </CButton>
              </CInputGroup>
            </div>

            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '100px' }}>상태</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '150px' }}>제목</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '150px' }}>게시 기간</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '50px' }}>조회수</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '120px' }}>작업</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {notices.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={5} className="text-center">
                      등록된 공지사항이 없습니다.
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  notices.map((notice) => (
                    <CTableRow key={notice.notice_id}>
                      <CTableDataCell>
                        <CBadge color={notice.is_public ? 'success' : 'danger'}>
                          {notice.is_public ? '공개' : '비공개'}
                        </CBadge>
                        {notice.is_important && (
                          <CBadge color="info" className="ms-1">중요</CBadge>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>{notice.title}</CTableDataCell>
                      <CTableDataCell>
                        {format(new Date(notice.start_date), 'yyyy-MM-dd')} ~ {format(new Date(notice.end_date), 'yyyy-MM-dd')}
                      </CTableDataCell>
                      <CTableDataCell>{notice.view_count}</CTableDataCell>
                      <CTableDataCell>
                        <CButton 
                          color="info"
                          size="sm"
                          className="me-2"
                          onClick={() => navigate(`/notices/${notice.notice_id}/edit`)}
                        >
                          수정
                        </CButton>
                        <CButton
                          color="danger"
                          size="sm"
                          onClick={() => handleDelete(notice.notice_id)}
                        >
                          삭제
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>

            {totalCount > 0 && (
              <CPagination align="center" aria-label="Page navigation">
                <CPaginationItem 
                  aria-label="Previous"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                >
                  <span aria-hidden="true">&laquo;</span>
                </CPaginationItem>
                {Array.from({ length: Math.min(5, Math.ceil(totalCount / limit)) }, (_, i) => (
                  <CPaginationItem
                    key={i + 1}
                    active={currentPage === i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </CPaginationItem>
                ))}
                <CPaginationItem
                  aria-label="Next"
                  disabled={currentPage >= Math.ceil(totalCount / limit)}
                  onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / limit), currentPage + 1))}
                >
                  <span aria-hidden="true">&raquo;</span>
                </CPaginationItem>
              </CPagination>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default NoticeList