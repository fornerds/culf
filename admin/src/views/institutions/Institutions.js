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

const Institutions = () => {
  const [institutions, setInstitutions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedInstitution, setSelectedInstitution] = useState(null)
  
  // 모달 상태
  const [showModal, setShowModal] = useState(false)
  const [showFileModal, setShowFileModal] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' or 'edit'
  
  // 폼 데이터
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    category: '',
    contact: '',
    email: '',
    address: '',
    website: '',
    description: '',
    manager: '',
    is_active: true
  })
  
  // 파일 업로드 상태
  const [files, setFiles] = useState([])
  const [uploadLoading, setUploadLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [activeFileTab, setActiveFileTab] = useState('files')

  // 탭 변경 핸들러
  const handleFileTabChange = (newTab) => {
    setActiveFileTab(newTab)
  }

  useEffect(() => {
    loadInstitutions()
  }, [])

  const loadInstitutions = async () => {
    try {
      setLoading(true)
      // 관리자는 비활성 기관도 포함해서 조회
      const response = await httpClient.get('/exhibitions/institutions?include_inactive=true')
      setInstitutions(response.data || [])
    } catch (err) {
      console.error('기관 목록 로드 오류:', err)
      setError('기관 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setModalMode('create')
    setFormData({
      name: '',
      type: '',
      category: '',
      contact: '',
      email: '',
      address: '',
      website: '',
      description: '',
      manager: '',
      is_active: true
    })
    setShowModal(true)
  }

  const handleEdit = (institution) => {
    setModalMode('edit')
    setFormData({
      name: institution.name || '',
      type: institution.type || '',
      category: institution.category || '',
      contact: institution.contact || '',
      email: institution.email || '',
      address: institution.address || '',
      website: institution.website || '',
      description: institution.description || '',
      manager: institution.manager || '',
      is_active: institution.is_active !== false
    })
    setSelectedInstitution(institution)
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      
      if (modalMode === 'create') {
        await httpClient.post('/exhibitions/institutions', formData)
      } else {
        await httpClient.put(`/exhibitions/institutions/${selectedInstitution.id}`, formData)
      }
      
      setShowModal(false)
      await loadInstitutions()
    } catch (err) {
      console.error('기관 저장 오류:', err)
      setError(`기관 ${modalMode === 'create' ? '등록' : '수정'}에 실패했습니다.`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (institution) => {
    if (window.confirm(`"${institution.name}" 기관을 삭제하시겠습니까?`)) {
      try {
        setLoading(true)
        await httpClient.delete(`/exhibitions/institutions/${institution.id}`)
        await loadInstitutions()
      } catch (err) {
        console.error('기관 삭제 오류:', err)
        setError('기관 삭제에 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }
  }



  const handleFileManagement = (institution) => {
    setSelectedInstitution(institution)
    setActiveFileTab('files')
    setShowFileModal(true)
    loadInstitutionFiles(institution.id)
  }

  const loadInstitutionFiles = async (institutionId) => {
    try {
      const response = await httpClient.get(`/exhibitions/institutions/${institutionId}/files`)
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
        formData.append('institution_id', selectedInstitution.id)
        formData.append('file_type', 'institution_document')
        
        await httpClient.post('/exhibitions/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      }
      
      await loadInstitutionFiles(selectedInstitution.id)
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
        await loadInstitutionFiles(selectedInstitution.id)
      } catch (err) {
        console.error('파일 삭제 오류:', err)
        setError('파일 삭제에 실패했습니다.')
      }
    }
  }

  return (
    <>
      <CRow>
        <CCol xs={12}>
          <CCard className="mb-4">
            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">기관 관리</h4>
                <CButton color="primary" onClick={handleCreate}>
                  <CIcon icon={cilPlus} className="me-2" />
                  기관 등록
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
                      <CTableHeaderCell>기관명</CTableHeaderCell>
                      <CTableHeaderCell>유형</CTableHeaderCell>
                      <CTableHeaderCell>카테고리</CTableHeaderCell>
                      <CTableHeaderCell>연락처</CTableHeaderCell>
                      <CTableHeaderCell>담당자</CTableHeaderCell>
                      <CTableHeaderCell>주소</CTableHeaderCell>
                      <CTableHeaderCell>상태</CTableHeaderCell>
                      <CTableHeaderCell>관리</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {institutions.map((institution) => (
                      <CTableRow key={institution.id}>
                        <CTableDataCell>
                          <strong>
                            {institution.name}
                          </strong>
                        </CTableDataCell>
                        <CTableDataCell>{institution.type}</CTableDataCell>
                        <CTableDataCell>{institution.category}</CTableDataCell>
                        <CTableDataCell>{institution.contact}</CTableDataCell>
                        <CTableDataCell>{institution.manager}</CTableDataCell>
                        <CTableDataCell>{institution.address}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={institution.is_active ? 'success' : 'danger'}>
                            {institution.is_active ? '활성' : '비활성'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div className="d-flex gap-2">
                            <CButton
                              color="info"
                              size="sm"
                              onClick={() => handleEdit(institution)}
                            >
                              <CIcon icon={cilPencil} />
                            </CButton>
                            <CButton
                              color="warning"
                              size="sm"
                              onClick={() => handleFileManagement(institution)}
                            >
                              <CIcon icon={cilFolder} />
                            </CButton>
                            <CButton
                              color="danger"
                              size="sm"
                              onClick={() => handleDelete(institution)}
                            >
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                    {institutions.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan="8" className="text-center">
                          등록된 기관이 없습니다.
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

      {/* 기관 등록/수정 모달 */}
      <CModal visible={showModal} onClose={() => setShowModal(false)} size="lg">
        <CModalHeader>
          <CModalTitle>
            {modalMode === 'create' ? '기관 등록' : '기관 수정'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm onSubmit={handleSubmit}>
            <CRow>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>기관명 *</CFormLabel>
                  <CFormInput
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </CCol>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>유형</CFormLabel>
                  <CFormSelect
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="">선택하세요</option>
                    <option value="미술관">미술관</option>
                    <option value="박물관">박물관</option>
                    <option value="문화회관">문화회관</option>
                    <option value="갤러리">갤러리</option>
                    <option value="기타">기타</option>
                  </CFormSelect>
                </div>
              </CCol>
            </CRow>

            <CRow>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>카테고리</CFormLabel>
                  <CFormInput
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
              </CCol>
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
            </CRow>

            <CRow>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>이메일</CFormLabel>
                  <CFormInput
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </CCol>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>담당자</CFormLabel>
                  <CFormInput
                    type="text"
                    value={formData.manager}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  />
                </div>
              </CCol>
            </CRow>

            <div className="mb-3">
              <CFormLabel>주소</CFormLabel>
              <CFormInput
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="mb-3">
              <CFormLabel>웹사이트</CFormLabel>
              <CFormInput
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>

            <div className="mb-3">
              <CFormLabel>설명</CFormLabel>
              <CFormTextarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="mb-3">
              <CFormCheck
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                label="활성 상태"
              />
            </div>
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
            {selectedInstitution?.name} - 파일 관리
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CTabs activeItemKey={activeFileTab} onChange={handleFileTabChange}>
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

export default Institutions 