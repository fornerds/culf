import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CForm,
  CFormInput,
  CFormLabel,
  CFormCheck,
  CButton,
  CImage,
  CSpinner,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const BannerEdit = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    target_url: '',
    start_date: '',
    end_date: '',
    is_public: true,
    image_url: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    fetchBanner()
  }, [id])

  const fetchBanner = async () => {
    try {
      const response = await httpClient.get(`/banners/${id}`)
      const data = response.data
      setFormData({
        target_url: data.target_url || '',
        start_date: formatDate(data.start_date),
        end_date: formatDate(data.end_date),
        is_public: data.is_public,
        image_url: data.image_url,
      })
      setPreviewUrl(data.image_url)
    } catch (error) {
      console.error('배너 정보 조회 실패:', error)
      alert('배너 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const data = new FormData()
    if (imageFile) {
      data.append('image_file', imageFile)
    }
    data.append('target_url', formData.target_url)
    data.append('start_date', formData.start_date)
    data.append('end_date', formData.end_date)
    data.append('is_public', formData.is_public)

    try {
      await httpClient.put(`/banners/${id}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      alert('배너가 성공적으로 수정되었습니다.')
      navigate('/banners')
    } catch (error) {
      console.error('배너 수정 실패:', error)
      console.error('에러 상세:', error.response?.data)
      alert('배너 수정에 실패했습니다.')
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
            <strong>배너 수정</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel>현재 배너 이미지</CFormLabel>
                {previewUrl && (
                  <div className="mb-2">
                    <CImage src={previewUrl} width={200} />
                  </div>
                )}
                <CFormLabel>새 배너 이미지</CFormLabel>
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                <small className="text-muted">새 이미지를 선택하지 않으면 기존 이미지가 유지됩니다.</small>
              </div>
              <div className="mb-3">
                <CFormLabel>링크 URL</CFormLabel>
                <CFormInput
                  type="url"
                  value={formData.target_url}
                  onChange={(e) => setFormData({ ...formData, target_url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="mb-3">
                <CFormLabel>시작일</CFormLabel>
                <CFormInput
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <CFormLabel>종료일</CFormLabel>
                <CFormInput
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <CFormCheck
                  id="isPublic"
                  label="공개"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                />
              </div>
              <div>
                <CButton type="submit" color="primary" className="me-2">
                  수정
                </CButton>
                <CButton 
                  type="button" 
                  color="secondary" 
                  onClick={() => navigate('/banners')}
                >
                  취소
                </CButton>
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default BannerEdit