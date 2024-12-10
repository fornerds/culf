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
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const CuratorEdit = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    introduction: '',
    category: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  // 카테고리 옵션
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
        introduction: data.introduction || '',
        category: data.category || '',
      })
      if (data.profile_image) {
        setPreviewUrl(data.profile_image)
      }
    } catch (error) {
      console.error('큐레이터 정보 조회 실패:', error)
      alert('큐레이터 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
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
    
    try {
      if (imageFile) {
        // 이미지가 있는 경우 FormData로 처리
        const data = new FormData()
        data.append('profile_image', imageFile)
        data.append('name', formData.name)
        data.append('introduction', formData.introduction)
        data.append('category', formData.category)
  
        await httpClient.put(`/curators/${id}`, data, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      } else {
        // 이미지가 없는 경우도 FormData 사용
        const data = new FormData()
        data.append('name', formData.name)
        data.append('introduction', formData.introduction)
        data.append('category', formData.category)
  
        await httpClient.put(`/curators/${id}`, data, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      }
      
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
                <CFormLabel>프로필 이미지</CFormLabel>
                {previewUrl && (
                  <div className="mb-2">
                    <CImage 
                      src={previewUrl} 
                      width={100} 
                      height={100} 
                      className="rounded-circle"
                    />
                  </div>
                )}
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
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
              <div>
                <CButton type="submit" color="primary" className="me-2">
                  수정
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

export default CuratorEdit