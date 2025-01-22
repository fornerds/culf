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
  CImage,
  CBadge,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const Curators = () => {
  const [curators, setCurators] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchCurators()
  }, [])

  const fetchCurators = async () => {
    try {
      const response = await httpClient.get('/curators')
      setCurators(response.data)
    } catch (error) {
      console.error('Error fetching curators:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (curatorId) => {
    if (window.confirm('이 캐릭터를 삭제하시겠습니까?')) {
      try {
        await httpClient.delete(`/curators/${curatorId}`)
        fetchCurators()
      } catch (error) {
        console.error('Error deleting curator:', error)
      }
    }
  }

  const renderTags = (tags) => {
    return tags?.map((tag, index) => (
      <CBadge 
        key={index} 
        color="info" 
        className="me-1"
        style={{ fontSize: '0.8rem' }}
      >
        {tag.name}
      </CBadge>
    ))
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
            <strong>캐릭터 관리</strong>
            <CButton 
              color="primary"
              onClick={() => navigate('/curators/create')}
            >
              캐릭터 추가
            </CButton>
          </CCardHeader>
          <CCardBody>
            <CTable hover align="middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '110px' }}>메인 이미지</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '100px' }}>프로필</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '80px' }}>이름</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '220px' }}>페르소나</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '90px' }}>카테고리</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '150px' }}>태그</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '120px' }}>작업</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {curators.map((curator) => (
                  <CTableRow key={curator.curator_id}>
                    <CTableDataCell>
                      {curator.main_image && (
                        <CImage
                          rounded
                          src={curator.main_image}
                          width={80}
                          height={80}
                          className="object-fit-cover"
                        />
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {curator.profile_image && (
                        <CImage
                          rounded
                          src={curator.profile_image}
                          width={80}
                          height={80}
                          className="object-fit-cover"
                        />
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      <strong>{curator.name}</strong>
                    </CTableDataCell>
                    <CTableDataCell>{curator.persona || '-'}</CTableDataCell>
                    <CTableDataCell>{curator.category || '-'}</CTableDataCell>
                    <CTableDataCell>{renderTags(curator.tags)}</CTableDataCell>
                    <CTableDataCell>
                      <CButton 
                        color="info"
                        size="sm"
                        className="me-2"
                        onClick={() => navigate(`/curators/${curator.curator_id}/edit`)}
                      >
                        수정
                      </CButton>
                      <CButton
                        color="danger"
                        size="sm"
                        onClick={() => handleDelete(curator.curator_id)}
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

export default Curators