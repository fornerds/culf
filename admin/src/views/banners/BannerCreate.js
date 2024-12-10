import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const BannerCreate = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    target_url: '',
    start_date: '',
    end_date: '',
    is_public: true,
  })
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

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
    if (!imageFile) {
      alert('배너 이미지를 선택해주세요.')
      return
    }
    
    data.append('image_file', imageFile)
    data.append('target_url', formData.target_url)
    data.append('start_date', formData.start_date)
    data.append('end_date', formData.end_date)
    data.append('is_public', formData.is_public)

    try {
      await httpClient.post('/banners', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      alert('배너가 성공적으로 등록되었습니다.')
      navigate('/banners')
    } catch (error) {
      console.error('배너 생성 실패:', error)
      console.error('에러 상세:', error.response?.data)
      alert('배너 등록에 실패했습니다.')
    }
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>새 배너 등록</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel>배너 이미지</CFormLabel>
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  required
                />
                {previewUrl && (
                  <CImage src={previewUrl} width={200} className="mt-2" />
                )}
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
                  등록
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

export default BannerCreate