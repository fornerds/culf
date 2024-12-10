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
} from '@coreui/react'
import httpClient from '../../api/httpClient'
import { format } from 'date-fns'

const Banners = () => {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchBanners()
  }, [])

  const fetchBanners = async () => {
    try {
      const response = await httpClient.get('/banners')
      setBanners(response.data)
    } catch (error) {
      console.error('Error fetching banners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (bannerId) => {
    if (window.confirm('이 배너를 삭제하시겠습니까?')) {
      try {
        await httpClient.delete(`/banners/${bannerId}`)
        fetchBanners()
      } catch (error) {
        console.error('Error deleting banner:', error)
      }
    }
  }

  const formatDate = (dateStr) => {
    return format(new Date(dateStr), 'yyyy-MM-dd')
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
            <strong>배너 관리</strong>
            <CButton 
              color="primary"
              onClick={() => navigate('/banners/create')}
            >
              배너 추가
            </CButton>
          </CCardHeader>
          <CCardBody>
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>이미지</CTableHeaderCell>
                  <CTableHeaderCell>링크</CTableHeaderCell>
                  <CTableHeaderCell>시작일</CTableHeaderCell>
                  <CTableHeaderCell>종료일</CTableHeaderCell>
                  <CTableHeaderCell>상태</CTableHeaderCell>
                  <CTableHeaderCell>클릭수</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '150px' }}>작업</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {banners.map((banner) => (
                  <CTableRow key={banner.banner_id}>
                    <CTableDataCell>
                      <img 
                        src={banner.image_url} 
                        alt="배너" 
                        style={{ height: '50px' }}
                      />
                    </CTableDataCell>
                    <CTableDataCell>{banner.target_url || '-'}</CTableDataCell>
                    <CTableDataCell>{formatDate(banner.start_date)}</CTableDataCell>
                    <CTableDataCell>{formatDate(banner.end_date)}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={banner.is_public ? 'success' : 'danger'}>
                        {banner.is_public ? '공개' : '비공개'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{banner.click_count}</CTableDataCell>
                    <CTableDataCell>
                      <CButton 
                        color="info"
                        size="sm"
                        className="me-2"
                        onClick={() => navigate(`/banners/${banner.banner_id}/edit`)}
                      >
                        수정
                      </CButton>
                      <CButton
                        color="danger"
                        size="sm"
                        onClick={() => handleDelete(banner.banner_id)}
                      >
                        삭제
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

export default Banners
