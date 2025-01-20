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
  CBadge,
  CInputGroup,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const CuratorCreate = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    persona: '',
    introduction: '',
    category: '',
    tag_names: [],
    background_color: '#FFFFFF',
    text_color: '#000000',
    shadow_color: '#888888'
  })
  const [mainImageFile, setMainImageFile] = useState(null)
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [mainImagePreview, setMainImagePreview] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState(null)
  const [currentTag, setCurrentTag] = useState('')

  // Category options
  const categoryOptions = [
    { value: '', label: '카테고리 선택' },
    { value: '미술', label: '미술' },
    { value: '문화', label: '문화' },
    { value: '여행', label: '여행' }
  ]

  const handleMainImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setMainImageFile(file)
      setMainImagePreview(URL.createObjectURL(file))
    }
  }

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setProfileImageFile(file)
      setProfileImagePreview(URL.createObjectURL(file))
    }
  }

  const handleAddTag = () => {
    if (currentTag && formData.tag_names.length < 2) {
      setFormData({
        ...formData,
        tag_names: [...formData.tag_names, currentTag],
      })
      setCurrentTag('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tag_names: formData.tag_names.filter(tag => tag !== tagToRemove),
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const data = new FormData()
    
    if (mainImageFile) {
      data.append('main_image', mainImageFile)
    }
    if (profileImageFile) {
      data.append('profile_image', profileImageFile)
    }
    
    data.append('name', formData.name)
    data.append('persona', formData.persona)
    data.append('introduction', formData.introduction)
    data.append('category', formData.category)
    data.append('background_color', formData.background_color)
    data.append('shadow_color', formData.shadow_color)
    data.append('text_color', formData.text_color)
    formData.tag_names.forEach(tag => {
      data.append('tag_names', tag)
    })

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

  const renderColorPreview = (color) => {
    return (
      <div
        style={{
          width: '30px',
          height: '30px',
          backgroundColor: color,
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginLeft: '10px'
        }}
      />
    )
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
                <CFormLabel>메인 이미지</CFormLabel>
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleMainImageChange}
                  required
                />
                {mainImagePreview && (
                  <CImage 
                    src={mainImagePreview} 
                    width={200} 
                    className="mt-2"
                  />
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>프로필 이미지</CFormLabel>
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  required
                />
                {profileImagePreview && (
                  <CImage 
                    src={profileImagePreview} 
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
                <CFormLabel>페르소나</CFormLabel>
                <CFormInput
                  type="text"
                  value={formData.persona}
                  onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                  placeholder="예: 지구 예술에 푹 빠진 외계인"
                  required
                />
              </div>
              <div className="mb-3">
                <CFormLabel>특성</CFormLabel>
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
                <CFormLabel>배경색</CFormLabel>
                <div className="d-flex align-items-center">
                  <CFormInput
                    type="color"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    required
                    style={{ width: '100px' }}
                  />
                  <span className="ms-2">{formData.background_color}</span>
                  {renderColorPreview(formData.background_color)}
                </div>
              </div>
              <div className="mb-3">
              <CFormLabel>그림자색</CFormLabel>
              <div className="d-flex align-items-center">
                <CFormInput
                  type="color"
                  value={formData.shadow_color}
                  onChange={(e) => setFormData({ ...formData, shadow_color: e.target.value })}
                  required
                  style={{ width: '100px' }}
                />
                <span className="ms-2">{formData.shadow_color}</span>
                {renderColorPreview(formData.shadow_color)}
              </div>
            </div>
              <div className="mb-3">
                <CFormLabel>글자색</CFormLabel>
                <div className="d-flex align-items-center">
                  <CFormInput
                    type="color"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    required
                    style={{ width: '100px' }}
                  />
                  <span className="ms-2">{formData.text_color}</span>
                  {renderColorPreview(formData.text_color)}
                </div>
              </div>
              <div className="mb-3">
                <CFormLabel>태그 (최대 2개)</CFormLabel>
                <CInputGroup>
                  <CFormInput
                    type="text"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    placeholder="태그를 입력하세요"
                    disabled={formData.tag_names.length >= 2}
                  />
                  <CButton 
                    type="button" 
                    color="primary" 
                    onClick={handleAddTag}
                    disabled={!currentTag || formData.tag_names.length >= 2}
                  >
                    추가
                  </CButton>
                </CInputGroup>
                <div className="mt-2">
                  {formData.tag_names.map((tag, index) => (
                    <CBadge 
                      key={index} 
                      color="info" 
                      className="me-2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} ✕
                    </CBadge>
                  ))}
                </div>
              </div>
              <div className="d-flex justify-content-center">
                <CButton 
                  type="submit" 
                  color="primary" 
                  className="me-4 px-5"
                >
                  등록
                </CButton>
                <CButton 
                  type="button" 
                  color="secondary" 
                  className="px-5"
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