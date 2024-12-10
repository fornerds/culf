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
  CFormTextarea,
  CButton,
  CImage,
  CFormSelect,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const CuratorCreate = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    introduction: '',
    category: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Category options
  const categoryOptions = [
    { value: '', label: '카테고리 선택' },
    { value: '예술', label: '예술' },
    { value: '문화', label: '문화' },
    { value: '여행', label: '여행' }
  ]

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
      data.append('profile_image', imageFile)
    }
    
    data.append('name', formData.name)
    data.append('introduction', formData.introduction)
    data.append('category', formData.category)

    try {
      const response = await httpClient.post('/curators', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      console.log('Response:', response)
      navigate('/curators')
    } catch (error) {
      console.error('Error creating curator:', error)
      console.error('Error details:', error.response?.data)
      alert('큐레이터 생성 중 오류가 발생했습니다.')
    }
  }

  const handleSearch = (e) => {
    setSearchQuery(e.target.value)
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>새 큐레이터 등록</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel>프로필 이미지</CFormLabel>
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  required
                />
                {previewUrl && (
                  <CImage 
                    src={previewUrl} 
                    width={100} 
                    height={100} 
                    className="mt-2 rounded-circle"
                  />
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>이름</CFormLabel>
                <CFormInput
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <CFormLabel>소개</CFormLabel>
                <CFormTextarea
                  rows={3}
                  value={formData.introduction}
                  onChange={(e) => setFormData({ ...formData, introduction: e.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <CFormLabel>카테고리</CFormLabel>
                <CFormSelect
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CFormSelect>
              </div>
              <div className="mb-3">
                <CFormLabel>사용자 검색</CFormLabel>
                <CFormInput
                  type="text"
                  placeholder="사용자 닉네임을 입력하세요"
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
              <div>
                <CButton type="submit" color="primary" className="me-2">
                  등록
                </CButton>
                <CButton 
                  type="button" 
                  color="secondary" 
                  onClick={() => navigate('/curators')}
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

export default CuratorCreate