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
  CFormTextarea,
  CButton,
  CImage,
  CSpinner,
  CFormSelect,
  CBadge,
  CInputGroup,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const CuratorEdit = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    persona: '',
    introduction: '',
    category: '',
    tag_names: [],
  })
  const [mainImageFile, setMainImageFile] = useState(null)
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [mainImagePreview, setMainImagePreview] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState(null)
  const [currentTag, setCurrentTag] = useState('')

  const categoryOptions = [
    { value: '', label: '카테고리 선택' },
    { value: '예술', label: '예술' },
    { value: '문화', label: '문화' },
    { value: '여행', label: '여행' }
  ]

  useEffect(() => {
    fetchCurator()
  }, [id])

  const fetchCurator = async () => {
    try {
      const response = await httpClient.get(`/curators/${id}`)
      const data = response.data
      setFormData({
        name: data.name || '',
        persona: data.persona || '',
        introduction: data.introduction || '',
        category: data.category || '',
        tag_names: data.tags?.map(tag => tag.name) || [],
      })
      if (data.main_image) {
        setMainImagePreview(data.main_image)
      }
      if (data.profile_image) {
        setProfileImagePreview(data.profile_image)
      }
    } catch (error) {
      console.error('큐레이터 정보 조회 실패:', error)
      alert('큐레이터 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

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
    
    try {
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
      formData.tag_names.forEach(tag => {
        data.append('tag_names', tag)
      })

      await httpClient.put(`/curators/${id}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      alert('큐레이터 정보가 성공적으로 수정되었습니다.')
      navigate('/curators')
    } catch (error) {
      console.error('큐레이터 수정 실패:', error)
      console.error('에러 상세:', error.response?.data)
      alert('큐레이터 정보 수정에 실패했습니다.')
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
            <strong>큐레이터 수정</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel>메인 이미지</CFormLabel>
                {mainImagePreview && (
                  <div className="mb-2">
                    <CImage 
                      src={mainImagePreview} 
                      width={200}
                    />
                  </div>
                )}
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleMainImageChange}
                />
                <small className="text-muted">새 이미지를 선택하지 않으면 기존 이미지가 유지됩니다.</small>
              </div>
              <div className="mb-3">
                <CFormLabel>프로필 이미지</CFormLabel>
                {profileImagePreview && (
                  <div className="mb-2">
                    <CImage 
                      src={profileImagePreview} 
                      width={100} 
                      height={100} 
                      className="rounded-circle"
                    />
                  </div>
                )}
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                />
                <small className="text-muted">새 이미지를 선택하지 않으면 기존 이미지가 유지됩니다.</small>
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
    className="me-4 px-5"  // px-5로 좌우 패딩 추가
  >
                      수정
                </CButton>
                <CButton 
    type="button" 
    color="secondary" 
    className="px-5"      // px-5로 좌우 패딩 추가
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

export default CuratorEdit