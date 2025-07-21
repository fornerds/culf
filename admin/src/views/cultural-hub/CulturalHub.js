import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CSpinner,
  CBadge,
  CAlert,
  CProgress,
  CProgressBar,
  CNav,
  CNavItem,
  CNavLink,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CCallout,
  CAccordion,
  CAccordionItem,
  CAccordionHeader,
  CAccordionBody,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCloudDownload,
  cilCheckCircle,
  cilXCircle,
  cilReload,
  cilChart,
  cilInfo,
  cilBriefcase,
  cilPlaylistAdd,
} from '@coreui/icons'
import httpClient from '../../api/httpClient'

const CulturalHub = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [systemStatus, setSystemStatus] = useState(null)
  const [error, setError] = useState(null)
  const [collectionResult, setCollectionResult] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [collectionModal, setCollectionModal] = useState(false)
  const [collectionConfig, setCollectionConfig] = useState({
    max_pages: 5,
    use_sequential: true,
    incremental: true
  })
  const [collectionProgress, setCollectionProgress] = useState(null)

  useEffect(() => {
    loadSystemStatus()
  }, [])

  const loadSystemStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await httpClient.get('/exhibitions/cultural-hub/status')
      setSystemStatus(response.data)
    } catch (err) {
      console.error('시스템 상태 로드 오류:', err)
      setError('시스템 상태를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const testApiConnections = async () => {
    try {
      setTestLoading(true)
      setError(null)
      
      const response = await httpClient.get('/exhibitions/cultural-hub/test')
      
      if (response.data && typeof response.data === 'object') {
        const testData = {
          working_apis: response.data.working_apis || 0,
          total_apis: response.data.total_apis || 0,
          details: response.data.details || {}
        }
        setTestResult(testData)
      }
    } catch (err) {
      console.error('API 테스트 오류:', err)
      setError('API 연결 테스트에 실패했습니다.')
    } finally {
      setTestLoading(false)
    }
  }

  const startDataCollection = async () => {
    try {
      setLoading(true)
      setError(null)
      setCollectionProgress({ current: 0, total: 15, status: '데이터 수집 시작...' })
      
      const response = await httpClient.post('/exhibitions/cultural-hub/collect', collectionConfig)
      
      if (response.data && typeof response.data === 'object') {
        const collectionData = {
          success: response.data.success || false,
          total_new: response.data.total_new || 0,
          total_updated: response.data.total_updated || 0,
          total_skipped: response.data.total_skipped || 0,
          working_apis: response.data.working_apis || 0,
          total_apis: response.data.total_apis || 0,
          api_details: response.data.api_details || {},
          message: response.data.message || ''
        }
        
        setCollectionResult(collectionData)
        
        if (collectionData.success) {
          setCollectionProgress({ 
            current: 15, 
            total: 15, 
            status: '수집 완료!',
            details: collectionData
          })
          setTimeout(() => loadSystemStatus(), 1000)
        }
      }
      
      setCollectionModal(false)
    } catch (err) {
      console.error('데이터 수집 오류:', err)
      setError('데이터 수집 중 오류가 발생했습니다.')
      setCollectionProgress(null)
    } finally {
      setLoading(false)
    }
  }

  const syncSpecificSource = async (sourceId) => {
    try {
      setLoading(true)
      
      const response = await httpClient.post('/exhibitions/cultural-hub/sync', {
        source_id: sourceId,
        incremental: true
      })
      
      if (response.data && response.data.success) {
        loadSystemStatus()
      }
    } catch (err) {
      console.error('동기화 오류:', err)
      setError(`${sourceId} 동기화 중 오류가 발생했습니다.`)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (isWorking, dataCount) => {
    const working = Boolean(isWorking)
    const count = Number(dataCount) || 0
    
    if (working && count > 0) {
      return <CBadge color="success">정상</CBadge>
    } else if (working) {
      return <CBadge color="warning">연결됨</CBadge>
    } else {
      return <CBadge color="danger">오류</CBadge>
    }
  }

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'success'
    if (percentage >= 60) return 'info'
    if (percentage >= 40) return 'warning'
    return 'danger'
  }

  if (loading) {
    return (
      <div className="text-center p-4">
        <CSpinner />
        <p className="mt-2">데이터를 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <CAlert color="danger" className="m-3">
        {error}
        <CButton 
          color="link" 
          onClick={loadSystemStatus}
          className="p-0 ms-2"
        >
          다시 시도
        </CButton>
      </CAlert>
    )
  }

  return (
    <>
      <CRow>
        <CCol xs={12}>
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <strong>데이터 관리</strong>
              <div>
                <CButton 
                  color="info" 
                  variant="outline" 
                  onClick={loadSystemStatus}
                  disabled={loading}
                  className="me-2"
                >
                  <CIcon icon={cilReload} className="me-1" />
                  새로고침
                </CButton>
                <CButton 
                  color="primary" 
                  onClick={() => setCollectionModal(true)}
                  disabled={loading}
                >
                  <CIcon icon={cilCloudDownload} className="me-1" />
                  데이터 수집
                </CButton>
              </div>
            </CCardHeader>
            <CCardBody>
            <CNav variant="tabs" className="mb-4">
              <CNavItem>
                <CNavLink
                  active={activeTab === 'overview'}
                  onClick={() => setActiveTab('overview')}
                  style={{ cursor: 'pointer' }}
                >
                  <CIcon icon={cilChart} className="me-1" />
                  데이터 현황
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink
                  active={activeTab === 'apis'}
                  onClick={() => setActiveTab('apis')}
                  style={{ cursor: 'pointer' }}
                >
                  <CIcon icon={cilBriefcase} className="me-1" />
                  API 상태
                </CNavLink>
              </CNavItem>
            </CNav>
          {error && (
            <CAlert color="danger" className="mb-4">
              {error}
            </CAlert>
          )}

          {/* 데이터 현황 탭 */}
          {activeTab === 'overview' && (
            <>
              {collectionProgress && (
                <CCallout color="info" className="mb-4">
                  <h5>수집 진행 상황</h5>
                  <CProgress className="mb-2">
                    <CProgressBar 
                      value={Math.round(((collectionProgress.current || 0) / (collectionProgress.total || 1)) * 100)}
                      color={(collectionProgress.current || 0) === (collectionProgress.total || 1) ? 'success' : 'primary'}
                    >
                      {Math.round(((collectionProgress.current || 0) / (collectionProgress.total || 1)) * 100)}%
                    </CProgressBar>
                  </CProgress>
                  <p className="mb-0">{collectionProgress.status}</p>
                  {collectionProgress.details && (
                    <div className="mt-2">
                      <small>
                        새로운 데이터: <strong>{collectionProgress.details.total_new || 0}개</strong> | 
                        업데이트: <strong>{collectionProgress.details.total_updated || 0}개</strong> | 
                        건너뜀: <strong>{collectionProgress.details.total_skipped || 0}개</strong>
                      </small>
                    </div>
                  )}
                </CCallout>
              )}

              {collectionResult && (
                <div className="mb-4">
                  <h5 className="mb-3">최근 수집 결과</h5>
                  <CRow className="mb-4">
                    <CCol md={3}>
                      <div className="border-start border-4 border-success ps-3">
                        <div className="text-success">성공한 API</div>
                        <div className="fs-5 fw-bold">{collectionResult?.working_apis || 0}/{collectionResult?.total_apis || 0}</div>
                      </div>
                    </CCol>
                    <CCol md={3}>
                      <div className="border-start border-4 border-primary ps-3">
                        <div className="text-primary">새 데이터</div>
                        <div className="fs-5 fw-bold">{(collectionResult?.total_new || 0).toLocaleString()}개</div>
                      </div>
                    </CCol>
                    <CCol md={3}>
                      <div className="border-start border-4 border-warning ps-3">
                        <div className="text-warning">업데이트</div>
                        <div className="fs-5 fw-bold">{(collectionResult?.total_updated || 0).toLocaleString()}개</div>
                      </div>
                    </CCol>
                    <CCol md={3}>
                      <div className="border-start border-4 border-info ps-3">
                        <div className="text-info">중복 제거</div>
                        <div className="fs-5 fw-bold">{(collectionResult?.total_skipped || 0).toLocaleString()}개</div>
                      </div>
                    </CCol>
                  </CRow>

                  {collectionResult?.api_details && (
                    <div>
                      <h6 className="mb-3">API별 상세 결과</h6>
                      <CAccordion>
                        {collectionResult?.api_details && typeof collectionResult.api_details === 'object' && Object.entries(collectionResult.api_details).map(([apiKey, details], index) => (
                          <CAccordionItem key={index} itemKey={index}>
                            <CAccordionHeader>
                              {(details && details.name) || apiKey} 
                              <CBadge color={(details && details.success) ? "success" : "danger"} className="ms-2">
                                {(details && details.success) ? "성공" : "실패"}
                              </CBadge>
                            </CAccordionHeader>
                            <CAccordionBody>
                              <CRow>
                                <CCol md={4}>새 데이터: <strong>{(details && details.new_count) || 0}개</strong></CCol>
                                <CCol md={4}>업데이트: <strong>{(details && details.updated_count) || 0}개</strong></CCol>
                                <CCol md={4}>건너뜀: <strong>{(details && details.skipped_count) || 0}개</strong></CCol>
                              </CRow>
                              {details && details.message && (
                                <div className="mt-2">
                                  <small className="text-muted">{details.message}</small>
                                </div>
                              )}
                            </CAccordionBody>
                          </CAccordionItem>
                        ))}
                      </CAccordion>
                    </div>
                  )}
                </div>
              )}

              <CRow>
                <CCol lg={12}>
                  <div className="mb-4">
                    <h5 className="mb-3">시스템 개요</h5>
                    {systemStatus ? (
                      <CRow>
                        <CCol md={3}>
                          <div className="border-start border-4 border-primary ps-3 mb-3">
                            <div className="text-primary">데이터 소스</div>
                            <div className="fs-5 fw-bold">{systemStatus?.system_summary?.total_sources || 0}개</div>
                          </div>
                        </CCol>
                        <CCol md={3}>
                          <div className="border-start border-4 border-success ps-3 mb-3">
                            <div className="text-success">총 전시</div>
                            <div className="fs-5 fw-bold">{(systemStatus?.system_summary?.total_exhibitions || 0).toLocaleString()}개</div>
                          </div>
                        </CCol>
                        <CCol md={3}>
                          <div className="border-start border-4 border-info ps-3 mb-3">
                            <div className="text-info">총 기관</div>
                            <div className="fs-5 fw-bold">{(systemStatus?.system_summary?.total_institutions || 0).toLocaleString()}개</div>
                          </div>
                        </CCol>
                        <CCol md={3}>
                          <div className="border-start border-4 border-warning ps-3 mb-3">
                            <div className="text-warning">마지막 수집</div>
                            <div className="fs-6">
                              {systemStatus?.system_summary?.last_collection 
                                ? new Date(systemStatus.system_summary.last_collection).toLocaleDateString('ko-KR')
                                : '없음'
                              }
                            </div>
                          </div>
                        </CCol>
                      </CRow>
                    ) : (
                      <div className="text-center">
                        <CSpinner />
                        <p className="mt-2 mb-0">시스템 상태 로딩 중...</p>
                      </div>
                    )}
                  </div>
                </CCol>
              </CRow>

              <CRow>
                <CCol lg={6}>
                  <div className="mb-4">
                    <h5 className="mb-3">데이터 분포</h5>
                    {systemStatus?.all_api_sources && systemStatus.all_api_sources.length > 0 ? (
                      <div>
                        {systemStatus.all_api_sources
                          .sort((a, b) => (b.data_count || 0) - (a.data_count || 0))
                          .map((source, index) => {
                            const total = systemStatus.all_api_sources.reduce((sum, s) => sum + (s.data_count || 0), 0);
                            const percentage = total > 0 ? Math.round(((source.data_count || 0) / total) * 100) : 0;
                            
                            return (
                              <div key={index} className="mb-3">
                                <div className="d-flex justify-content-between mb-1">
                                  <span>{source.name || '알 수 없음'}</span>
                                  <span><strong>{(source.data_count || 0).toLocaleString()}개</strong></span>
                                </div>
                                <CProgress>
                                  <CProgressBar value={percentage} color="primary">
                                    {percentage}%
                                  </CProgressBar>
                                </CProgress>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-center text-muted py-4">
                        <CIcon icon={cilChart} size="xl" className="mb-3" />
                        <p>데이터가 없습니다.</p>
                      </div>
                    )}
                  </div>
                </CCol>
                <CCol lg={6}>
                  <div className="mb-4">
                    <h5 className="mb-3">지역별 통계</h5>
                    {systemStatus?.all_api_sources && systemStatus.all_api_sources.length > 0 ? (
                      <div>
                        {Object.entries(
                          systemStatus.all_api_sources.reduce((acc, source) => {
                            const location = source.location || '기타';
                            acc[location] = (acc[location] || 0) + (source.data_count || 0);
                            return acc;
                          }, {})
                        )
                        .sort(([,a], [,b]) => b - a)
                        .map(([location, count], index) => (
                          <div key={index} className="d-flex justify-content-between py-2 border-bottom">
                            <span>{location}</span>
                            <span><strong>{count.toLocaleString()}개</strong></span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted py-4">
                        <CIcon icon={cilChart} size="xl" className="mb-3" />
                        <p>지역별 데이터가 없습니다.</p>
                      </div>
                    )}
                  </div>
                </CCol>
              </CRow>
            </>
          )}

          {/* API 상태 탭 */}
          {activeTab === 'apis' && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="mb-0">API 데이터 소스</h5>
                  {systemStatus?.all_api_sources && (
                    <small className="text-muted">
                      총 {systemStatus.all_api_sources.length}개
                    </small>
                  )}
                </div>
                <div>
                  <CButton 
                    color="outline-primary" 
                    onClick={testApiConnections}
                    disabled={testLoading}
                    size="sm"
                  >
                    {testLoading ? (
                      <>
                        <CSpinner size="sm" className="me-2" />
                        테스트 중...
                      </>
                    ) : (
                      <>
                        <CIcon icon={cilCheckCircle} className="me-1" />
                        API 연결 테스트
                      </>
                    )}
                  </CButton>
                </div>
              </div>

              {testResult && (
                <CCallout color="info" className="mb-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <span>작동 중인 API: <strong>{testResult?.working_apis || 0}/{testResult?.total_apis || 0}</strong></span>
                    <CProgress style={{ width: '200px' }}>
                      <CProgressBar 
                        value={Math.round(((testResult?.working_apis || 0) / (testResult?.total_apis || 1)) * 100)}
                        color={getProgressColor(Math.round(((testResult?.working_apis || 0) / (testResult?.total_apis || 1)) * 100))}
                      >
                        {Math.round(((testResult?.working_apis || 0) / (testResult?.total_apis || 1)) * 100)}%
                      </CProgressBar>
                    </CProgress>
                  </div>
                </CCallout>
              )}

              {systemStatus?.all_api_sources && systemStatus.all_api_sources.length > 0 ? (
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>API 이름</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">기관 유형</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">지역</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">상태</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">데이터 수</CTableHeaderCell>
                      <CTableHeaderCell className="text-center">마지막 동기화</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {systemStatus.all_api_sources
                      .sort((a, b) => (a.priority || 999) - (b.priority || 999))
                      .map((source, index) => (
                      <CTableRow key={index}>
                        <CTableDataCell className="align-middle">
                          <strong>{source.name || '알 수 없음'}</strong>
                          <br />
                          <small className="text-muted">
                            {source.description || '설명 없음'}
                          </small>
                        </CTableDataCell>
                        <CTableDataCell className="align-middle text-center">
                          {source.institution_type || '기타'}
                        </CTableDataCell>
                        <CTableDataCell className="align-middle text-center">
                          {source.location || '전국'}
                        </CTableDataCell>
                        <CTableDataCell className="align-middle text-center">
                          {getStatusBadge(source.is_working, source.data_count)}
                        </CTableDataCell>
                        <CTableDataCell className="align-middle text-center">
                          <strong>
                            {(source.data_count || 0).toLocaleString()}개
                          </strong>
                        </CTableDataCell>
                        <CTableDataCell className="align-middle text-center">
                          {source.last_sync 
                            ? new Date(source.last_sync).toLocaleString('ko-KR')
                            : '없음'
                          }
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              ) : (
                <div className="text-center text-muted py-5">
                  <CIcon icon={cilInfo} size="xl" className="mb-3" />
                  <p>API 데이터가 없습니다.</p>
                </div>
              )}
            </>
          )}

          {/* 통계 탭 */}
          {activeTab === 'statistics' && (
            <CRow>
              <CCol lg={6}>
                <div className="mb-4">
                  <h5 className="mb-3">데이터 분포</h5>
                  {systemStatus?.all_api_sources && systemStatus.all_api_sources.length > 0 ? (
                    <div>
                      {systemStatus.all_api_sources
                        .sort((a, b) => (b.data_count || 0) - (a.data_count || 0))
                        .map((source, index) => {
                          const total = systemStatus.all_api_sources.reduce((sum, s) => sum + (s.data_count || 0), 0);
                          const percentage = total > 0 ? Math.round(((source.data_count || 0) / total) * 100) : 0;
                          
                          return (
                            <div key={index} className="mb-3">
                              <div className="d-flex justify-content-between mb-1">
                                <span>{source.name || '알 수 없음'}</span>
                                <span><strong>{(source.data_count || 0).toLocaleString()}개</strong></span>
                              </div>
                              <CProgress>
                                <CProgressBar value={percentage} color="primary">
                                  {percentage}%
                                </CProgressBar>
                              </CProgress>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center text-muted py-4">
                      <CIcon icon={cilChart} size="xl" className="mb-3" />
                      <p>데이터가 없습니다.</p>
                    </div>
                  )}
                </div>
              </CCol>
              <CCol lg={6}>
                <div className="mb-4">
                  <h5 className="mb-3">지역별 통계</h5>
                  {systemStatus?.all_api_sources && systemStatus.all_api_sources.length > 0 ? (
                    <div>
                      {Object.entries(
                        systemStatus.all_api_sources.reduce((acc, source) => {
                          const location = source.location || '기타';
                          acc[location] = (acc[location] || 0) + (source.data_count || 0);
                          return acc;
                        }, {})
                      )
                      .sort(([,a], [,b]) => b - a)
                      .map(([location, count], index) => (
                        <div key={index} className="d-flex justify-content-between py-2 border-bottom">
                          <span>{location}</span>
                          <span><strong>{count.toLocaleString()}개</strong></span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted py-4">
                      <CIcon icon={cilChart} size="xl" className="mb-3" />
                      <p>지역별 데이터가 없습니다.</p>
                    </div>
                  )}
                </div>
              </CCol>
            </CRow>
          )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    {/* 데이터 수집 설정 모달 */}
    <CModal
      visible={collectionModal}
      onClose={() => setCollectionModal(false)}
      size="lg"
    >
      <CModalHeader>
        <CModalTitle>데이터 수집 설정</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow>
          <CCol md={6}>
            <CFormLabel>최대 페이지 수</CFormLabel>
            <CFormInput
              type="number"
              value={collectionConfig.max_pages}
              onChange={(e) => setCollectionConfig({
                ...collectionConfig,
                max_pages: parseInt(e.target.value) || 5
              })}
              min="1"
              max="50"
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel>수집 방식</CFormLabel>
            <CFormSelect
              value={collectionConfig.use_sequential ? 'sequential' : 'parallel'}
              onChange={(e) => setCollectionConfig({
                ...collectionConfig,
                use_sequential: e.target.value === 'sequential'
              })}
            >
              <option value="sequential">순차 수집</option>
              <option value="parallel">병렬 수집</option>
            </CFormSelect>
          </CCol>
        </CRow>
        <CRow className="mt-3">
          <CCol md={12}>
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="incremental"
                checked={collectionConfig.incremental}
                onChange={(e) => setCollectionConfig({
                  ...collectionConfig,
                  incremental: e.target.checked
                })}
              />
              <label className="form-check-label" htmlFor="incremental">
                증분 수집 (새로운 데이터만)
              </label>
            </div>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton 
          color="secondary" 
          onClick={() => setCollectionModal(false)}
        >
          취소
        </CButton>
        <CButton 
          color="primary" 
          onClick={startDataCollection}
          disabled={loading}
        >
          {loading ? (
            <>
              <CSpinner size="sm" className="me-2" />
              수집 중...
            </>
          ) : (
            <>
              <CIcon icon={cilPlaylistAdd} className="me-1" />
              수집 시작
            </>
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  </>
  )
}

export default CulturalHub 