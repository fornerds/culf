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
  CFormTextarea,
  CImage,
  CSpinner,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const NoticeEdit = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    fetchNotice()
  }, [id])

  const fetchNotice = async () => {
    try {
      const { data } = await httpClient.get(`/admin/notices/${id}`)
      setFormData({
        title: data.title,
        content: data.content,
        start_date: formatDate(data.start_date),
        end_date: formatDate(data.end_date),
        is_public: data.is_public,
        is_important: data.is_important,
        image_url: data.image_url,
      })
      if (data.image_url) {
        setPreviewUrl(data.image_url)
      }
    } catch (error) {
      console.error('Error fetching notice:', error)
      alert('공지사항을 불러오는데 실패했습니다.')
      navigate('/notices')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
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

    // 날짜 유효성 검사
    const startDate = new Date(formData.start_date)
    const endDate = new Date(formData.end_date)

    if (endDate < startDate) {
      alert('종료일은 시작일보다 이후여야 합니다.')
      return
    }

    try {
      // 먼저 공지사항 정보 업데이트
      await httpClient.put(`/admin/notices/${id}`, {
        title: formData.title,
        content: formData.content,
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_public: formData.is_public,
        is_important: formData.is_important
      })

      // 새 이미지가 있는 경우 이미지 업로드
      if (imageFile) {
        const imageData = new FormData()
        imageData.append('image_file', imageFile)
        await httpClient.put(`/admin/notices/${id}/image`, imageData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      }

      alert('공지사항이 성공적으로 수정되었습니다.')
      navigate('/notices')
    } catch (error) {
      console.error('Error updating notice:', error)
      alert('공지사항 수정에 실패했습니다.')
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
            <strong>공지사항 수정</strong>
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
                {previewUrl && (
                  <div className="mb-2">
                    <CImage src={previewUrl} width={200} />
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
                  수정
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

export default NoticeEdit