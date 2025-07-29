import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormInput,
  CFormTextarea,
  CFormLabel,
  CFormSelect,
  CBadge,
  CSpinner,
  CAlert,
  CTabs,
  CTabList,
  CTab,
  CTabContent,
  CTabPanel,
  CFormCheck
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilPencil, cilTrash, cilCloudUpload, cilFolder } from '@coreui/icons'
import httpClient from '../../api/httpClient'

const Exhibitions = () => {
  const [exhibitions, setExhibitions] = useState([])
  const [institutions, setInstitutions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedExhibition, setSelectedExhibition] = useState(null)
  
  // 모달 상태
  const [showModal, setShowModal] = useState(false)
  const [showFileModal, setShowFileModal] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' or 'edit'
  
  // 폼 데이터
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    start_date: '',
    end_date: '',
    venue: '',
    address: '',
    category: '',
    genre: '',
    artist: '',
    host: '',
    contact: '',
    price: '',
    website: '',
    image_url: '',
    status: 'active',
    keywords: '',
    institution_id: '',
    is_active: true
  })
  
  // 파일 업로드 상태
  const [files, setFiles] = useState([])
  const [uploadLoading, setUploadLoading] = useState(false)

  useEffect(() => {
    loadExhibitions()
    loadInstitutions()
  }, [])

  const loadExhibitions = async () => {
    try {
      setLoading(true)
      const response = await httpClient.get('/exhibitions/exhibitions?admin_view=true')
      setExhibitions(response.data || [])
    } catch (err) {
      console.error('전시 목록 로드 오류:', err)
      setError('전시 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadInstitutions = async () => {
    try {
      const response = await httpClient.get('/exhibitions/institutions')
      setInstitutions(response.data || [])
    } catch (err) {
      console.error('기관 목록 로드 오류:', err)
    }
  }

  const handleCreate = () => {
    setModalMode('create')
    setFormData({
      title: '',
      subtitle: '',
      description: '',
      start_date: '',
      end_date: '',
      venue: '',
      address: '',
      category: '',
      genre: '',
      artist: '',
      host: '',
      contact: '',
      price: '',
      website: '',
      image_url: '',
      status: 'active',
      keywords: '',
      institution_id: '',
      is_active: true
    })
    setShowModal(true)
  }

  const handleEdit = (exhibition) => {
    setModalMode('edit')
    setFormData({
      title: exhibition.title || '',
      subtitle: exhibition.subtitle || '',
      description: exhibition.description || '',
      start_date: exhibition.start_date || '',
      end_date: exhibition.end_date || '',
      venue: exhibition.venue || '',
      address: exhibition.address || '',
      category: exhibition.category || '',
      genre: exhibition.genre || '',
      artist: exhibition.artist || '',
      host: exhibition.host || '',
      contact: exhibition.contact || '',
      price: exhibition.price || '',
      website: exhibition.website || '',
      image_url: exhibition.image_url || '',
      status: exhibition.status || 'active',
      keywords: exhibition.keywords || '',
      institution_id: exhibition.institution_id || '',
      is_active: exhibition.is_active !== false
    })
    setSelectedExhibition(exhibition)
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      
      if (modalMode === 'create') {
        await httpClient.post('/exhibitions/exhibitions', formData)
      } else {
        await httpClient.put(`/exhibitions/exhibitions/${selectedExhibition.id}`, formData)
      }
      
      setShowModal(false)
      await loadExhibitions()
    } catch (err) {
      console.error('전시 저장 오류:', err)
      setError(`전시 ${modalMode === 'create' ? '등록' : '수정'}에 실패했습니다.`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (exhibition) => {
    if (window.confirm(`"${exhibition.title}" 전시를 삭제하시겠습니까?`)) {
      try {
        setLoading(true)
        await httpClient.delete(`/exhibitions/events/${exhibition.id}`)
        await loadExhibitions()
      } catch (err) {
        console.error('전시 삭제 오류:', err)
        setError('전시 삭제에 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleFileManagement = (exhibition) => {
    setSelectedExhibition(exhibition)
    setShowFileModal(true)
    loadExhibitionFiles(exhibition.id)
  }

  const loadExhibitionFiles = async (exhibitionId) => {
    try {
      const response = await httpClient.get(`/exhibitions/exhibitions/${exhibitionId}/files`)
      setFiles(response.data || [])
    } catch (err) {
      console.error('파일 목록 로드 오류:', err)
      setFiles([])
    }
  }

  const handleFileUpload = async (event) => {
    const selectedFiles = Array.from(event.target.files)
    if (selectedFiles.length === 0) return

    try {
      setUploadLoading(true)
      
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('exhibition_id', selectedExhibition.id)
        formData.append('file_type', 'exhibition_document')
        
        await httpClient.post('/exhibitions/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      }
      
      await loadExhibitionFiles(selectedExhibition.id)
      event.target.value = '' // 파일 입력 초기화
    } catch (err) {
      console.error('파일 업로드 오류:', err)
      setError('파일 업로드에 실패했습니다.')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleFileDelete = async (fileId) => {
    if (window.confirm('이 파일을 삭제하시겠습니까?')) {
      try {
        await httpClient.delete(`/exhibitions/files/${fileId}`)
        await loadExhibitionFiles(selectedExhibition.id)
      } catch (err) {
        console.error('파일 삭제 오류:', err)
        setError('파일 삭제에 실패했습니다.')
      }
    }
  }

  const getInstitutionName = (institutionId) => {
    const institution = institutions.find(inst => inst.id === institutionId)
    return institution ? institution.name : '-'
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  return (
    <>
      <CRow>
        <CCol xs={12}>
          <CCard className="mb-4">
            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">전시 관리</h4>
                <CButton color="primary" onClick={handleCreate}>
                  <CIcon icon={cilPlus} className="me-2" />
                  전시 등록
                </CButton>
              </div>
            </CCardHeader>
            <CCardBody>
              {error && (
                <CAlert color="danger" onClose={() => setError(null)} dismissible>
                  {error}
                </CAlert>
              )}

              {loading ? (
                <div className="text-center">
                  <CSpinner color="primary" />
                </div>
              ) : (
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>전시명</CTableHeaderCell>
                      <CTableHeaderCell>기관</CTableHeaderCell>
                      <CTableHeaderCell>장소</CTableHeaderCell>
                      <CTableHeaderCell>기간</CTableHeaderCell>
                      <CTableHeaderCell>상태</CTableHeaderCell>
                      <CTableHeaderCell>관리</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {exhibitions.map((exhibition) => (
                      <CTableRow 
                        key={exhibition.id}
                        style={{
                          opacity: exhibition.is_active ? 1 : 0.6,
                          backgroundColor: exhibition.is_active ? 'transparent' : '#f8f9fa'
                        }}
                      >
                        <CTableDataCell>
                          <strong style={{ color: exhibition.is_active ? 'inherit' : '#6c757d' }}>
                            {exhibition.title}
                          </strong>
                          {exhibition.subtitle && (
                            <div className="text-muted small">{exhibition.subtitle}</div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell>{getInstitutionName(exhibition.institution_id)}</CTableDataCell>
                        <CTableDataCell>{exhibition.venue}</CTableDataCell>
                        <CTableDataCell>
                          {formatDate(exhibition.start_date)} ~ {formatDate(exhibition.end_date)}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={exhibition.is_active ? 'success' : 'danger'}>
                            {exhibition.is_active ? '활성' : '비활성'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div className="d-flex gap-2">
                            <CButton
                              color="info"
                              size="sm"
                              onClick={() => handleEdit(exhibition)}
                            >
                              <CIcon icon={cilPencil} />
                            </CButton>
                            <CButton
                              color="warning"
                              size="sm"
                              onClick={() => handleFileManagement(exhibition)}
                            >
                              <CIcon icon={cilFolder} />
                            </CButton>
                            <CButton
                              color="danger"
                              size="sm"
                              onClick={() => handleDelete(exhibition)}
                            >
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                    {exhibitions.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan="6" className="text-center">
                          등록된 전시가 없습니다.
                        </CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* 전시 등록/수정 모달 */}
      <CModal visible={showModal} onClose={() => setShowModal(false)} size="xl">
        <CModalHeader>
          <CModalTitle>
            {modalMode === 'create' ? '전시 등록' : '전시 수정'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm onSubmit={handleSubmit}>
            <CTabs activeItemKey="basic">
              <CTabList variant="tabs">
                <CTab itemKey="basic">기본 정보</CTab>
                <CTab itemKey="details">상세 정보</CTab>
              </CTabList>
              <CTabContent className="mt-4">
                <CTabPanel itemKey="basic">
                  <CRow>
                    <CCol md={8}>
                      <div className="mb-3">
                        <CFormLabel>전시명 *</CFormLabel>
                        <CFormInput
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          required
                        />
                      </div>
                    </CCol>
                    <CCol md={4}>
                      <div className="mb-3">
                        <CFormLabel>기관</CFormLabel>
                        <CFormSelect
                          value={formData.institution_id}
                          onChange={(e) => setFormData({ ...formData, institution_id: e.target.value })}
                        >
                          <option value="">선택하세요</option>
                          {institutions.map((institution) => (
                            <option key={institution.id} value={institution.id}>
                              {institution.name}
                            </option>
                          ))}
                        </CFormSelect>
                      </div>
                    </CCol>
                  </CRow>

                  <div className="mb-3">
                    <CFormLabel>부제목</CFormLabel>
                    <CFormInput
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    />
                  </div>

                  <CRow>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>시작일</CFormLabel>
                        <CFormInput
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                      </div>
                    </CCol>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>종료일</CFormLabel>
                        <CFormInput
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        />
                      </div>
                    </CCol>
                  </CRow>

                  <CRow>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>장소</CFormLabel>
                        <CFormInput
                          type="text"
                          value={formData.venue}
                          onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                        />
                      </div>
                    </CCol>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>주소</CFormLabel>
                        <CFormInput
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>
                    </CCol>
                  </CRow>

                  <div className="mb-3">
                    <CFormLabel>설명</CFormLabel>
                    <CFormTextarea
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </CTabPanel>

                <CTabPanel itemKey="details">
                  <CRow>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>카테고리</CFormLabel>
                        <CFormSelect
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                          <option value="">선택하세요</option>
                          <option value="전시">전시</option>
                          <option value="공연">공연</option>
                          <option value="교육">교육</option>
                          <option value="체험">체험</option>
                          <option value="기타">기타</option>
                        </CFormSelect>
                      </div>
                    </CCol>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>장르</CFormLabel>
                        <CFormInput
                          type="text"
                          value={formData.genre}
                          onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                        />
                      </div>
                    </CCol>
                  </CRow>

                  <CRow>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>작가</CFormLabel>
                        <CFormInput
                          type="text"
                          value={formData.artist}
                          onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                        />
                      </div>
                    </CCol>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>주최</CFormLabel>
                        <CFormInput
                          type="text"
                          value={formData.host}
                          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        />
                      </div>
                    </CCol>
                  </CRow>

                  <CRow>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>연락처</CFormLabel>
                        <CFormInput
                          type="text"
                          value={formData.contact}
                          onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        />
                      </div>
                    </CCol>
                    <CCol md={6}>
                      <div className="mb-3">
                        <CFormLabel>가격</CFormLabel>
                        <CFormInput
                          type="text"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        />
                      </div>
                    </CCol>
                  </CRow>

                  <div className="mb-3">
                    <CFormLabel>웹사이트</CFormLabel>
                    <CFormInput
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <CFormLabel>이미지 URL</CFormLabel>
                    <CFormInput
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <CFormLabel>키워드</CFormLabel>
                    <CFormInput
                      type="text"
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      placeholder="쉼표로 구분"
                    />
                  </div>

                  <div className="mb-3">
                    <CFormCheck
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      label="활성 상태"
                    />
                  </div>
                </CTabPanel>
              </CTabContent>
            </CTabs>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModal(false)}>
            취소
          </CButton>
          <CButton color="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <CSpinner size="sm" className="me-2" /> : null}
            {modalMode === 'create' ? '등록' : '수정'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* 파일 관리 모달 */}
      <CModal visible={showFileModal} onClose={() => setShowFileModal(false)} size="xl">
        <CModalHeader>
          <CModalTitle>
            {selectedExhibition?.title} - 파일 관리
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CTabs activeItemKey="files">
            <CTabList variant="tabs">
              <CTab itemKey="files">파일 목록</CTab>
              <CTab itemKey="upload">파일 업로드</CTab>
            </CTabList>
            <CTabContent>
              <CTabPanel itemKey="files">
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>파일명</CTableHeaderCell>
                      <CTableHeaderCell>크기</CTableHeaderCell>
                      <CTableHeaderCell>업로드일</CTableHeaderCell>
                      <CTableHeaderCell>상태</CTableHeaderCell>
                      <CTableHeaderCell>관리</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {files.map((file) => (
                      <CTableRow key={file.file_id}>
                        <CTableDataCell>{file.original_filename}</CTableDataCell>
                        <CTableDataCell>{Math.round(file.file_size / 1024)} KB</CTableDataCell>
                        <CTableDataCell>
                          {new Date(file.uploaded_at).toLocaleDateString('ko-KR')}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={file.processing_status === 'completed' ? 'success' : 'warning'}>
                            {file.processing_status === 'completed' ? '처리완료' : '처리중'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton
                            color="danger"
                            size="sm"
                            onClick={() => handleFileDelete(file.file_id)}
                          >
                            <CIcon icon={cilTrash} />
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                    {files.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan="5" className="text-center">
                          업로드된 파일이 없습니다.
                        </CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>
              </CTabPanel>
              <CTabPanel itemKey="upload">
                <div className="mb-4">
                  <CFormLabel>파일 선택</CFormLabel>
                  <CFormInput
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md"
                    onChange={handleFileUpload}
                    disabled={uploadLoading}
                  />
                  <small className="text-muted">
                    지원 형식: PDF, DOC, DOCX, TXT, MD (최대 10MB)
                  </small>
                </div>
                {uploadLoading && (
                  <div className="text-center">
                    <CSpinner color="primary" />
                    <p className="mt-2">파일을 업로드하고 있습니다...</p>
                  </div>
                )}
              </CTabPanel>
            </CTabContent>
          </CTabs>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowFileModal(false)}>
            닫기
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Exhibitions 