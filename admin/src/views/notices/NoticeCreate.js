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
  CFormTextarea,
  CImage,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const NoticeCreate = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    start_date: '',
    end_date: '',
    is_public: true,
    is_important: false,
    image_url: '',
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

    // 날짜 유효성 검사
    const startDate = new Date(formData.start_date)
    const endDate = new Date(formData.end_date)

    if (endDate < startDate) {
      alert('종료일은 시작일보다 이후여야 합니다.')
      return
    }

    const data = new FormData()
    if (imageFile) {
      data.append('image_file', imageFile)
    }

    Object.keys(formData).forEach(key => {
      if (key !== 'image_url') {
        data.append(key, formData[key])
      }
    })

    try {
      await httpClient.post('/admin/notices', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      alert('공지사항이 성공적으로 등록되었습니다.')
      navigate('/notices')
    } catch (error) {
      console.error('Error creating notice:', error)
      alert('공지사항 등록에 실패했습니다.')
    }
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>새 공지사항 작성</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel>제목</CFormLabel>
                <CFormInput
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <CFormLabel>내용</CFormLabel>
                <CFormTextarea
                  rows={10}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <CFormLabel>이미지</CFormLabel>
                <CFormInput
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {previewUrl && (
                  <CImage src={previewUrl} width={200} className="mt-2" />
                )}
              </div>

              <div className="mb-3">
                <CFormLabel>게시 시작일</CFormLabel>
                <CFormInput
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <CFormLabel>게시 종료일</CFormLabel>
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

              <div className="mb-3">
                <CFormCheck
                  id="isImportant"
                  label="중요 공지사항"
                  checked={formData.is_important}
                  onChange={(e) => setFormData({ ...formData, is_important: e.target.checked })}
                />
              </div>

              <div className="d-flex justify-content-center gap-3">
                <CButton
                  type="submit"
                  color="primary"
                  className="px-5"
                >
                  등록
                </CButton>
                <CButton
                  type="button"
                  color="secondary"
                  className="px-5"
                  onClick={() => navigate('/notices')}
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

export default NoticeCreate