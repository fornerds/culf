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
    if (window.confirm('이 큐레이터를 삭제하시겠습니까?')) {
      try {
        await httpClient.delete(`/curators/${curatorId}`)
        fetchCurators()
      } catch (error) {
        console.error('Error deleting curator:', error)
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
            <strong>큐레이터 관리</strong>
            <CButton 
              color="primary"
              onClick={() => navigate('/curators/create')}
            >
              큐레이터 추가
            </CButton>
          </CCardHeader>
          <CCardBody>
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>이름</CTableHeaderCell>
                  <CTableHeaderCell>카테고리</CTableHeaderCell>
                  <CTableHeaderCell>소개</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '150px' }}>작업</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {curators.map((curator) => (
                  <CTableRow key={curator.curator_id}>
                    
                    <CTableDataCell>{curator.name}</CTableDataCell>
                    <CTableDataCell>{curator.category || '-'}</CTableDataCell>
                    <CTableDataCell>{curator.introduction || '-'}</CTableDataCell>
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
