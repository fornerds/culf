import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CNav,
  CNavItem,
  CNavLink,
  CButton,
  CSpinner,
  CAlert,
  CProgress,
  CProgressBar,
  CCallout,
  CBadge,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormCheck,
  CInputGroup,
  CPagination,
  CPaginationItem
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilChart,
  cilBriefcase,
  cilCloudDownload, 
  cilReload,
  cilPlaylistAdd,
  cilSettings,
  cilSearch,
  cilCalendar,
  cilLocationPin,
  cilUser
} from '@coreui/icons'
import httpClient from '../../api/httpClient'

const CulturalHub = () => {
  console.log('CulturalHub 컴포넌트 렌더링 시작')
  
  // 탭 상태
  const [activeTab, setActiveTab] = useState('overview')
  
  // 공통 상태
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // 시스템 상태
  const [systemStatus, setSystemStatus] = useState(null)
  
  // 수집된 데이터 관련 상태
  const [collectedData, setCollectedData] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // 수집 관련 상태
  const [collectionModal, setCollectionModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [collectionConfig, setCollectionConfig] = useState({
    max_pages: 5,
    use_sequential: true,
    incremental: true
  })
  const [collectionProgress, setCollectionProgress] = useState(null)
  const [collectionResult, setCollectionResult] = useState(null)
  const [currentProgressId, setCurrentProgressId] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [pollingInterval, setPollingInterval] = useState(null)
  const [singleApiLoading, setSingleApiLoading] = useState(new Set()) // API 테스트 로딩 상태
  const [apiTestResults, setApiTestResults] = useState(new Map()) // API 테스트 결과 상태

  useEffect(() => {
    loadSystemStatus()
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'data') {
      loadCollectedData()
    }
  }, [activeTab, currentPage, searchTerm, filterSource, sortBy, sortOrder])

  // 드래그 상태 관리를 위한 전역 마우스 이벤트
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false)
    
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp)
      return () => document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && collectionModal) {
        setCollectionModal(false)
        setIsDragging(false)
      }
    }

    if (collectionModal) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [collectionModal])

  const loadSystemStatus = async () => {
    try {
      setLoading(true)
      setError(null) // 이전 에러 상태 초기화
      
      // 10초 타임아웃으로 상태 조회
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const response = await httpClient.get('/exhibitions/cultural-hub/status', {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      // 응답 데이터 검증
      if (response && response.data) {
        setSystemStatus(response.data)
        console.log('시스템 상태 로드 성공')
      } else {
        console.warn('시스템 상태 응답 데이터가 비어있음')
        setSystemStatus(null)
      }
      
    } catch (err) {
      console.error('시스템 상태 로드 오류:', err)
      
      if (err.name === 'AbortError') {
        setError('시스템 상태 조회가 시간 초과되었습니다. 페이지를 새로고침해보세요.')
      } else if (err.response?.status === 500) {
        setError('서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해보세요.')
      } else if (err.code === 'NETWORK_ERROR') {
        setError('네트워크 연결을 확인해보세요.')
      } else {
        setError('시스템 상태를 불러오는데 실패했습니다.')
      }
      
      // 에러 발생 시에도 기본 상태 설정
      setSystemStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const loadCollectedData = async () => {
    try {
      setDataLoading(true)
      const params = new URLSearchParams({
        page: currentPage,
        size: 20,
        search: searchTerm,
        source: filterSource,
        include_inactive: false,
        sort_by: sortBy,
        sort_order: sortOrder
      })

      const response = await httpClient.get(`/exhibitions/events?${params}`)
      
      if (response.data) {
        setCollectedData(response.data.items || [])
        setTotalPages(response.data.pages || 1)
        setTotalItems(response.data.total || 0)
      }
    } catch (err) {
      console.error('수집된 데이터 로드 오류:', err)
      setError('수집된 데이터를 불러오는데 실패했습니다.')
    } finally {
      setDataLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadCollectedData()
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const cancelDataCollection = async () => {
    if (!currentProgressId || isCancelling) return
    
    console.log('데이터 수집 취소 요청 시작')
    setIsCancelling(true)
    
    try {
      // 서버에 취소 신호 전송
      const response = await httpClient.post(`/exhibitions/cultural-hub/collect/cancel/${currentProgressId}`)
      console.log('취소 신호 전송 완료:', response.data)
      
      // 폴링 중단
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
      
      // UI를 취소 완료 상태로 업데이트
      setCollectionProgress({
        completed: true,
        cancelled: true,
        status: '수집이 취소되었습니다',
        hasErrors: false,
        percentage: 100
      })
      
      // 2초 후 모달 닫기
      setTimeout(async () => {
        setCollectionModal(false)
        setCurrentProgressId(null)
        setIsCancelling(false)
        setCollectionProgress(null)
        setCollectionResult(null)
        setError(null)
        
        // 상태 새로고침 (에러 처리 포함)
        try {
          await loadSystemStatus()
        } catch (err) {
          console.error('취소 후 시스템 상태 새로고침 실패:', err)
          setError(null) // 에러 무시하고 화면 표시
          setLoading(false)
        }
      }, 2000)
      
    } catch (err) {
      console.error('취소 신호 전송 실패:', err)
      
      // 실패해도 UI는 취소 상태로 표시
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
      
      setCollectionProgress({
        completed: true,
        cancelled: true,
        status: '취소 요청 전송 실패 (로컬에서 중단됨)',
        hasErrors: true,
        percentage: 100
      })
      
      setTimeout(async () => {
        setCollectionModal(false)
        setCurrentProgressId(null)
        setIsCancelling(false)
        setCollectionProgress(null)
        setCollectionResult(null)
        setError(null)
        
        // 상태 새로고침 (에러 처리 포함)
        try {
          await loadSystemStatus()
        } catch (err) {
          console.error('취소 실패 후 시스템 상태 새로고침 실패:', err)
          setError(null)
          setLoading(false)
        }
      }, 2000)
    }
  }

  const forceStopAllCollections = async () => {
    try {
      console.log('모든 수집 작업 강제 중단 요청')
      
      // 폴링 즉시 중단
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
      
      // 강제 중단 API 호출
      const response = await httpClient.delete('/exhibitions/cultural-hub/collect/force-stop')
      console.log('강제 중단 완료:', response.data)
      
      // UI 즉시 업데이트
      setCollectionProgress({
        completed: true,
        cancelled: true,
        status: '모든 수집 작업이 강제 중단되었습니다',
        hasErrors: false,
        percentage: 100
      })
      
      // 상태 완전 초기화 및 페이지 새로고침
      setTimeout(() => {
        console.log('강제 중단 완료, 페이지 새로고침')
        // 페이지 새로고침으로 완전 초기화
        window.location.reload()
      }, 800)
      
    } catch (err) {
      console.error('강제 중단 실패:', err)
      
      // 실패해도 로컬 상태는 정리
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
      
      // 실패해도 페이지 새로고침
      setTimeout(() => {
        console.log('강제 중단 실패, 페이지 새로고침으로 복구')
        window.location.reload()
      }, 500)
    }
  }

  const startDataCollection = async () => {
    try {
      setLoading(true)
      setError(null)
      setCollectionProgress({
        current: 1,
        total: 8,
        status: '데이터 수집을 시작합니다...',
        percentage: 5
      })

      console.log('데이터 수집 시작:', collectionConfig)

      const response = await httpClient.post('/exhibitions/cultural-hub/collect', collectionConfig)
      console.log('API 응답:', response.data)

      if (response.data && response.data.progress_id) {
        const progressId = response.data.progress_id
        console.log('Progress ID 받음:', progressId)
        setCurrentProgressId(progressId)

        // 기존 폴링이 있다면 정리
        if (pollingInterval) {
          clearInterval(pollingInterval)
          console.log('기존 폴링 정리됨')
        }

        // 새로운 폴링 시작
        const interval = setInterval(async () => {
          if (isCancelling) {
            console.log('취소 요청으로 폴링 중단')
            clearInterval(interval)
            setPollingInterval(null)
            return
          }
          
          try {
            const progressResponse = await httpClient.get(`/exhibitions/cultural-hub/collect/progress/${progressId}`)
            const data = progressResponse.data
            
            console.log('진행 상황:', data)

            setCollectionProgress({
              current: data.step || 1,
              total: 8,
              status: data.message || '진행 중...',
              percentage: data.percentage || 0,
              completed: data.completed || false,
              hasErrors: !!data.error,
              error: data.error,
              details: data.results ? {
                total: data.results.total_collected || 0,
                new: data.results.total_new || 0,
                updated: data.results.total_updated || 0,
                skipped: data.results.total_skipped || 0,
                success_count: data.results.success_count || 0
              } : null
            })

            if (data.completed || data.cancelled) {
              console.log('수집 완료 감지, 폴링 중단')
              clearInterval(interval)
              setPollingInterval(null)
              console.log('데이터 수집 완료')
              
              // 결과 설정
              if (data.results) {
                setCollectionResult({
                  success: data.results.success || false,
                  total_new: data.results.total_new || 0,
                  total_updated: data.results.total_updated || 0,
                  total_skipped: data.results.total_skipped || 0,
                  working_apis: data.results.working_apis || 0,
                  total_apis: data.results.total_apis || 0,
                  api_details: data.results.api_details || {},
                  message: data.results.message || ''
                })
              }

              // 수집 완료 상태 유지 - 자동 새로고침 제거
              console.log('수집 완료, 화면 상태 유지')
              
              // 백엔드 처리 완료까지 잠시 대기 후 상태 새로고침
              setTimeout(() => {
                console.log('백엔드 처리 완료 대기 후 상태 갱신')
                loadSystemStatus()
              }, 2000) // 2초 대기
            }
          } catch (pollError) {
            console.error('폴링 에러:', pollError)
            
            // 504 Gateway Timeout의 경우 계속 시도
            if (pollError.response && pollError.response.status === 504) {
              console.log('504 타임아웃 에러 발생, 폴링 계속 시도...')
              // 504 에러는 무시하고 계속 폴링
              return
            }
            
            // 다른 에러의 경우 폴링 중단
            clearInterval(interval)
            setPollingInterval(null)
            setCollectionProgress({
              current: 8,
              total: 8,
              status: '진행 상황 확인 중 오류가 발생했습니다',
              percentage: 100,
              hasErrors: true,
              error: pollError.message
            })
          }
        }, 5000)  // setInterval 닫는 괄호와 폴링 간격 (5초)

        // 폴링 시작 저장
        setPollingInterval(interval)
      }
    } catch (err) {
      console.error('데이터 수집 오류:', err)
      setError(err.response?.data?.detail || '데이터 수집에 실패했습니다')
      setCollectionProgress({
        current: 8,
        total: 8,
        status: '오류 발생',
        percentage: 100,
        hasErrors: true,
        error: err.response?.data?.detail || '데이터 수집에 실패했습니다'
      })

      setTimeout(() => {
        setCollectionProgress(null)
      }, 5000)
    } finally {
      setLoading(false)
    }
  }

  const collectSingleApi = async (apiKey, apiName) => {
    try {
      // API 테스트 로딩 상태 시작
      setSingleApiLoading(prev => new Set([...prev, apiKey]))
      setError(null)
      
      console.log(`🔍 ${apiName} API 상태 확인 시작`)
      
      // API 상태 체크 (실제 수집 없이 연결 테스트만)
      const response = await httpClient.get(`/exhibitions/cultural-hub/test/${apiKey}`)
      const testResult = response.data
      
      // 테스트 결과를 Map에 저장
      if (testResult.success) {
        setApiTestResults(prev => new Map(prev).set(apiKey, {
          success: true,
          status: '정상',
          message: `사용 가능한 데이터: ${testResult.total_available}개`,
          time: new Date().toLocaleTimeString()
        }))
        console.log(`✅ ${apiName} API 테스트 성공: ${testResult.message}`)
      } else {
        setApiTestResults(prev => new Map(prev).set(apiKey, {
          success: false,
          status: '오류',
          message: testResult.message,
          time: new Date().toLocaleTimeString()
        }))
        console.log(`❌ ${apiName} API 테스트 실패: ${testResult.message}`)
      }
      
      // 상태 새로고침 (API 테스트 후 상태 업데이트)
      setTimeout(() => {
        loadSystemStatus()
      }, 500)
      
    } catch (err) {
      console.error(`${apiName} API 테스트 오류:`, err)
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message
      
      setApiTestResults(prev => new Map(prev).set(apiKey, {
        success: false,
        status: '실패',
        message: errorMessage,
        time: new Date().toLocaleTimeString()
      }))
    } finally {
      // API 테스트 로딩 상태 종료
      setSingleApiLoading(prev => {
        const newSet = new Set(prev)
        newSet.delete(apiKey)
        return newSet
      })
    }
  }

  const getStatusBadge = (isActive, dataCount) => {
    const active = Boolean(isActive)
    
    if (active) {
      return <CBadge color="success">활성</CBadge>
    } else {
      return <CBadge color="secondary">비활성</CBadge>
    }
  }

  const formatNumber = (num) => {
    return num ? num.toLocaleString() : '0'
  }





  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR')
  }

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '-'
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  const getSourceBadge = (source) => {
    const colors = {
      'arts_center': 'primary',
      'sejong_center': 'success', 
      'hangeul_museum': 'info',
      'craft_design_foundation': 'warning',
      'arko_art_center': 'danger',
      'seoul_museum': 'dark',
      'mapo_art_center': 'secondary',
      'mmca_museum': 'primary',
      'integrated_exhibition': 'success',
      'barrier_free': 'info',
      'jeju_culture': 'warning',
      'daegu_culture': 'danger',
      'sema_archive': 'dark'
    }
    
    return <CBadge color={colors[source] || 'secondary'}>{source}</CBadge>
  }

  console.log('CulturalHub 렌더링, 현재 상태:', { 
    activeTab, 
    loading, 
    error: error ? error.substring(0, 50) : null,
    hasSystemStatus: !!systemStatus,
    collectionModal
  })

  try {
    return (
      <>
        <CRow>
          <CCol xs={12}>
            <CCard className="mb-4">
              <CCardHeader>
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">데이터 관리</h4>
                  <div className="d-flex gap-2">
                    <CButton 
                      color="outline-primary" 
                      onClick={() => {
                        console.log('새로고침 버튼 클릭')
                        loadSystemStatus()
                      }}
                      disabled={loading}
                    >
                      <CIcon icon={cilReload} className="me-1" />
                      새로고침
                    </CButton>
                    <CButton 
                      color="primary" 
                      onClick={() => {
                        console.log('데이터 수집 버튼 클릭')
                        setCollectionModal(true)
                      }}
                      disabled={loading}
                    >
                      <CIcon icon={cilCloudDownload} className="me-1" />
                      데이터 수집
                    </CButton>
                  </div>
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
              <CNavItem>
                <CNavLink
                    active={activeTab === 'data'}
                    onClick={() => setActiveTab('data')}
                  style={{ cursor: 'pointer' }}
                >
                  <CIcon icon={cilPlaylistAdd} className="me-1" />
                    수집된 데이터
                </CNavLink>
              </CNavItem>
            </CNav>

          {error && (
            <CAlert color="danger" className="mb-4">
              {error}
            </CAlert>
          )}

              {/* 진행도 표시 */}
              {collectionProgress && (
                <CCallout className="mb-4" style={{ borderLeft: 'none', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">데이터 수집 진행 중</h5>
                    <span className="badge bg-primary fs-6">
                      {collectionProgress.current || 0}/{collectionProgress.total || 1} 단계
                    </span>
                  </div>
                  
                  <CProgress className="mb-3" height={20}>
                    <CProgressBar 
                      value={collectionProgress.percentage || 0}
                      color={
                        collectionProgress.hasErrors ? 'danger' : 
                        collectionProgress.completed ? 'success' : 'primary'
                      }
                      animated={!collectionProgress.completed && !collectionProgress.hasErrors}
                    >
                      {collectionProgress.percentage || 0}%
                    </CProgressBar>
                  </CProgress>
                  
                  <div className="d-flex align-items-center mb-2">
                    {collectionProgress.completed ? (
                      <span className="text-success me-2">완료</span>
                    ) : collectionProgress.hasErrors ? (
                      <span className="text-danger me-2">오류</span>
                    ) : (
                      <CSpinner size="sm" className="me-2" />
                    )}
                    <strong>{collectionProgress.status}</strong>
                  </div>
                  
                  {collectionProgress.details && (
                    <div className="mt-3 p-3 bg-light rounded">
                      <div className="row text-center">
                        <div className="col-md-3">
                          <div className="text-success">
                            <strong>{collectionProgress.details.new || 0}개</strong>
                      </div>
                          <small className="text-muted">신규 추가</small>
                      </div>
                        <div className="col-md-3">
                          <div className="text-info">
                            <strong>{collectionProgress.details.updated || 0}개</strong>
                      </div>
                          <small className="text-muted">업데이트</small>
                      </div>
                        <div className="col-md-3">
                          <div className="text-warning">
                            <strong>{collectionProgress.details.skipped || 0}개</strong>
                                </div>
                          <small className="text-muted">중복 제거</small>
                    </div>
                        <div className="col-md-3">
                          <div className="text-primary">
                            <strong>{collectionProgress.details.total || 0}개</strong>
                </div>
                          <small className="text-muted">총 수집</small>
                          </div>
                          </div>
                          </div>
                  )}
                </CCallout>
              )}

              {/* 데이터 현황 탭 */}
              {activeTab === 'overview' && (
                <>
                  {systemStatus ? (
                    <>
                      {/* 시스템 요약 */}
                      <CRow className="mb-4">
                        <CCol md={4}>
                          <CCard className="text-center">
                            <CCardBody>
                              <h3 className="text-primary">{formatNumber(systemStatus.summary?.total_events || 0)}</h3>
                              <p className="text-muted mb-0">총 수집 데이터</p>
                            </CCardBody>
                          </CCard>
                        </CCol>
                        <CCol md={4}>
                          <CCard className="text-center">
                            <CCardBody>
                              <h3 className="text-success">{systemStatus.summary?.total_locations || 0}</h3>
                              <p className="text-muted mb-0">지역 수</p>
                            </CCardBody>
                          </CCard>
                        </CCol>
                        <CCol md={4}>
                          <CCard className="text-center">
                            <CCardBody>
                              <h3 className="text-info">{systemStatus.summary?.total_apis || 0}</h3>
                              <p className="text-muted mb-0">총 API 소스</p>
                            </CCardBody>
                          </CCard>
                        </CCol>
                      </CRow>

                      {/* API 상태 요약 */}
                      <CRow>
                        <CCol xs={12}>
                          <CCard>
                            <CCardHeader>
                              <h5 className="mb-0">API 상태 요약</h5>
                            </CCardHeader>
                            <CCardBody>
                              <CTable hover responsive>
                                <CTableHead>
                                  <CTableRow>
                                    <CTableHeaderCell>API 이름</CTableHeaderCell>
                                    <CTableHeaderCell>데이터 수</CTableHeaderCell>
                                    <CTableHeaderCell>상태</CTableHeaderCell>
                                    <CTableHeaderCell>마지막 수집</CTableHeaderCell>
                                    <CTableHeaderCell>지역</CTableHeaderCell>
                                  </CTableRow>
                                </CTableHead>
                                <CTableBody>
                                  {systemStatus.api_sources?.map((api) => (
                                    <CTableRow key={api.api_key}>
                                      <CTableDataCell>
                                        <strong>{api.name}</strong>
                                      </CTableDataCell>
                                      <CTableDataCell>{formatNumber(api.data_count)}</CTableDataCell>
                                      <CTableDataCell>
                                        {getStatusBadge(api.is_active, api.data_count)}
                                      </CTableDataCell>
                                      <CTableDataCell>
                                        {formatDate(api.last_sync)}
                                      </CTableDataCell>
                                      <CTableDataCell>
                                        {api.location || '미상'}
                                      </CTableDataCell>
                                    </CTableRow>
                                  ))}
                                </CTableBody>
                              </CTable>
                            </CCardBody>
                          </CCard>
                        </CCol>
                      </CRow>
                    </>
                  ) : loading ? (
                    <div className="text-center py-5">
                      <CSpinner color="primary" />
                      <p className="mt-2 text-muted">시스템 상태를 불러오는 중...</p>
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <CAlert color="warning">
                        시스템 상태를 불러올 수 없습니다. 새로고침 버튼을 눌러보세요.
                      </CAlert>
                    </div>
                  )}
                </>
              )}

              {/* API 상태 및 수집 탭 */}
              {activeTab === 'apis' && (
                <>
                  {systemStatus ? (
                    <CRow>
                      <CCol xs={12}>
                        <CCard>
                          <CCardHeader>
                            <CButton 
                              variant="outline"
                              color="secondary"
                              size="sm"
                              onClick={loadSystemStatus}
                              disabled={loading}
                              className="float-end"
                            >
                              <CIcon icon={cilReload} className="me-1" />
                              새로고침
                            </CButton>
                          </CCardHeader>
                          <CCardBody>
                            <CTable hover responsive>
                              <CTableHead>
                                <CTableRow>
                                  <CTableHeaderCell>API 이름</CTableHeaderCell>
                                  <CTableHeaderCell>데이터 수</CTableHeaderCell>
                                  <CTableHeaderCell>상태</CTableHeaderCell>
                                  <CTableHeaderCell>마지막 수집</CTableHeaderCell>
                                  <CTableHeaderCell>지역</CTableHeaderCell>
                                                                      <CTableHeaderCell>API 테스트</CTableHeaderCell>
                                </CTableRow>
                              </CTableHead>
                              <CTableBody>
                                {systemStatus.api_sources?.map((api) => (
                                  <CTableRow key={api.api_key}>
                                    <CTableDataCell>
                                      <strong>{api.name}</strong>
                                      <br />
                                      <small className="text-muted">{api.api_key}</small>
                                    </CTableDataCell>
                                    <CTableDataCell>{formatNumber(api.data_count)}</CTableDataCell>
                                    <CTableDataCell>
                                      {getStatusBadge(api.is_active, api.data_count)}
                                    </CTableDataCell>
                                    <CTableDataCell>
                                      {formatDate(api.last_sync)}
                                    </CTableDataCell>
                                    <CTableDataCell>{api.location || '미상'}</CTableDataCell>
                                    <CTableDataCell>
                                      <div className="d-flex flex-column gap-1">
                                        <CButton
                                          color="outline-primary"
                                          size="sm"
                                          onClick={() => collectSingleApi(api.api_key, api.name)}
                                          disabled={loading || singleApiLoading.has(api.api_key)}
                                        >
                                          {singleApiLoading.has(api.api_key) ? (
                                            <>
                                              <CSpinner size="sm" className="me-1" />
                                              테스트중
                                            </>
                                          ) : (
                                            <>
                                              <CIcon icon={cilPlaylistAdd} className="me-1" />
                                              테스트
                                            </>
                                          )}
                                        </CButton>
                                        
                                        {/* 테스트 결과 표시 */}
                                        {apiTestResults.has(api.api_key) && (
                                          <div className="small">
                                            <div className={`d-flex align-items-center ${apiTestResults.get(api.api_key).success ? 'text-success' : 'text-danger'}`}>
                                              <span className="me-1">
                                                {apiTestResults.get(api.api_key).success ? '✅' : '❌'}
                                              </span>
                                              <strong>{apiTestResults.get(api.api_key).status}</strong>
                                            </div>
                                            <div className="text-muted" style={{fontSize: '0.75rem'}}>
                                              {apiTestResults.get(api.api_key).message}
                                            </div>
                                            <div className="text-muted" style={{fontSize: '0.7rem'}}>
                                              {apiTestResults.get(api.api_key).time}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </CTableDataCell>
                                  </CTableRow>
                                ))}
                              </CTableBody>
                            </CTable>
                          </CCardBody>
                        </CCard>
                      </CCol>
                    </CRow>
                  ) : loading ? (
                    <div className="text-center py-5">
                      <CSpinner color="primary" />
                      <p className="mt-2 text-muted">API 상태를 불러오는 중...</p>
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <CAlert color="warning">
                        API 상태를 불러올 수 없습니다. 새로고침 버튼을 눌러보세요.
                      </CAlert>
                    </div>
                  )}
                </>
              )}

              {/* 수집된 데이터 탭 */}
              {activeTab === 'data' && (
            <>
              {/* 검색 및 필터 */}
              <CRow className="mb-4">
                <CCol md={6}>
                  <CInputGroup>
                    <CFormInput
                          placeholder="제목, 장소, 작가로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <CButton 
                      color="primary" 
                          onClick={handleSearch}
                          disabled={dataLoading}
                    >
                          <CIcon icon={cilSearch} className="me-1" />
                      검색
                    </CButton>
                  </CInputGroup>
                </CCol>
                    <CCol md={3}>
                    <CFormSelect
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                      >
                        <option value="">모든 소스</option>
                        <option value="arts_center">예술의전당</option>
                        <option value="sejong_center">세종문화회관</option>
                        <option value="hangeul_museum">한글박물관</option>
                        <option value="craft_design_foundation">한국공예디자인문화진흥원</option>
                        <option value="arko_art_center">아르코미술관</option>
                        <option value="seoul_museum">서울역사박물관</option>
                        <option value="mapo_art_center">마포아트센터</option>
                        <option value="mmca_museum">국립현대미술관</option>
                        <option value="integrated_exhibition">통합전시정보</option>
                        <option value="barrier_free">배리어프리</option>
                        <option value="jeju_culture">제주문화예술진흥원</option>
                        <option value="daegu_culture">대구문화예술</option>
                        <option value="sema_archive">서울시립미술관</option>
                    </CFormSelect>
                    </CCol>
                    <CCol md={3}>
                    <CFormSelect
                        value={`${sortBy}_${sortOrder}`}
                        onChange={(e) => {
                          const [field, order] = e.target.value.split('_')
                          setSortBy(field)
                          setSortOrder(order)
                        }}
                      >
                        <option value="created_at_desc">최신 수집순</option>
                        <option value="created_at_asc">오래된 수집순</option>
                        <option value="start_date_desc">시작일 내림차순</option>
                        <option value="start_date_asc">시작일 오름차순</option>
                        <option value="title_asc">제목 가나다순</option>
                        <option value="venue_asc">장소 가나다순</option>
                    </CFormSelect>
                </CCol>
              </CRow>

                  {/* 데이터 목록 */}
                  <CRow>
                    <CCol xs={12}>
                      <CCard>
                        <CCardHeader>
                          <div className="d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">
                              수집된 데이터 ({formatNumber(totalItems)}개)
                            </h5>
                      <CButton 
                              color="outline-secondary" 
                        size="sm"
                              onClick={loadCollectedData}
                              disabled={dataLoading}
                      >
                              <CIcon icon={cilReload} className="me-1" />
                              새로고침
                      </CButton>
                    </div>
                        </CCardHeader>
                        <CCardBody>
                          {dataLoading ? (
                            <div className="text-center py-4">
                              <CSpinner color="primary" />
                              <p className="mt-2 text-muted">데이터를 불러오는 중...</p>
                </div>
                          ) : collectedData.length > 0 ? (
                            <>
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                                    <CTableHeaderCell style={{ width: '300px' }}>전시/공연 정보</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '120px' }}>소스</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '150px' }}>장소</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '200px' }}>기간</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '100px' }}>요금</CTableHeaderCell>
                                    <CTableHeaderCell style={{ width: '120px' }}>수집일</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                                  {collectedData.map((item) => (
                                    <CTableRow key={item.id}>
                        <CTableDataCell>
                                        <div>
                                          <strong className="d-block mb-1">
                                            {truncateText(item.title, 50)}
                                          </strong>
                                                                    <div className="text-muted small mb-1">
                            <CIcon icon={cilUser} size="sm" className="me-1" />
                            {item.artist ? truncateText(item.artist, 30) : '작가정보없음'}
                          </div>
                                          {item.description && (
                                            <div className="text-muted small">
                                              {truncateText(item.description, 80)}
                                            </div>
                                          )}
                                        </div>
                        </CTableDataCell>
                        <CTableDataCell>
                                        {getSourceBadge(item.api_source)}
                        </CTableDataCell>
                                                <CTableDataCell>
                          <div className="small">
                            <CIcon icon={cilLocationPin} size="sm" className="me-1" />
                            {item.venue ? truncateText(item.venue, 20) : '장소정보없음'}
                          </div>
                        </CTableDataCell>
                                                <CTableDataCell>
                          <div className="small">
                            <CIcon icon={cilCalendar} size="sm" className="me-1" />
                            {item.start_date ? (
                              <>
                                {formatDate(item.start_date)}
                                {item.end_date && item.start_date !== item.end_date && (
                                  <><br />~ {formatDate(item.end_date)}</>
                                )}
                                {item.time && (
                                  <div className="text-muted">
                                    {truncateText(item.time, 15)}
                                  </div>
                                )}
                              </>
                            ) : (
                              '기간정보없음'
                            )}
                          </div>
                        </CTableDataCell>
                        <CTableDataCell>
                                        <small>
                                          {item.price || '정보없음'}
                                        </small>
                        </CTableDataCell>
                                                <CTableDataCell>
                                        <small className="text-muted">
                                          {formatDate(item.created_at)}
                                        </small>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                              {/* 페이지네이션 */}
                              {totalPages > 1 && (
                                <div className="d-flex justify-content-center mt-4">
                                  <CPagination>
                                    <CPaginationItem 
                                      disabled={currentPage === 1}
                                      onClick={() => handlePageChange(1)}
                                    >
                                      처음
                                    </CPaginationItem>
                                    <CPaginationItem 
                                      disabled={currentPage === 1}
                                      onClick={() => handlePageChange(currentPage - 1)}
                                    >
                                      이전
                                    </CPaginationItem>
                                    
                                    {/* 페이지 번호들 */}
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                      const startPage = Math.max(1, currentPage - 2)
                                      const pageNum = startPage + i
                                      if (pageNum <= totalPages) {
                                        return (
                                          <CPaginationItem
                                            key={pageNum}
                                            active={pageNum === currentPage}
                                            onClick={() => handlePageChange(pageNum)}
                                          >
                                            {pageNum}
                                          </CPaginationItem>
                                        )
                                      }
                                      return null
                                    })}
                                    
                                    <CPaginationItem 
                                      disabled={currentPage === totalPages}
                                      onClick={() => handlePageChange(currentPage + 1)}
                                    >
                                      다음
                                    </CPaginationItem>
                                    <CPaginationItem 
                                      disabled={currentPage === totalPages}
                                      onClick={() => handlePageChange(totalPages)}
                                    >
                                      마지막
                                    </CPaginationItem>
                                  </CPagination>
                </div>
                              )}
                            </>
              ) : (
                <div className="text-center text-muted py-5">
                              <CIcon icon={cilPlaylistAdd} size="3xl" className="mb-3" />
                              <h6>수집된 데이터가 없습니다</h6>
                              <p className="mb-0">데이터 수집을 실행하여 문화 데이터를 가져와보세요.</p>
                </div>
              )}
                        </CCardBody>
                      </CCard>
                    </CCol>
                  </CRow>
            </>
          )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    {/* 데이터 수집 설정 모달 */}
    <CModal
      visible={collectionModal}
      onClose={() => {
        // 모달이 닫히려고 할 때 로그만 남기고 아무것도 하지 않음
        console.log('모달 닫기 시도 - 무시됨')
      }}
      size="lg"
      backdrop="static"
      keyboard={false}
    >
      <CModalHeader
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        style={{ cursor: 'move' }}
      >
        <CModalTitle>데이터 수집 설정</CModalTitle>
      </CModalHeader>
      <CModalBody onClick={(e) => e.stopPropagation()}>
        <CRow>
          <CCol md={6}>
            <CFormLabel>최대 페이지 수</CFormLabel>
            <CFormInput
              type="number"
              value={collectionConfig.max_pages}
                onChange={(e) => {
                  const value = e.target.value
                  setCollectionConfig({
                ...collectionConfig,
                    max_pages: value === '' ? '' : Math.max(1, parseInt(value) || 1)
                  })
                }}
              min="1"
                            max="200"
              placeholder="1-200 사이의 숫자를 입력하세요"
            />
              <small className="text-muted">
                • <strong>50페이지</strong>: 약 30,000개 (일반 수집 권장)<br/>
                • <strong>100페이지</strong>: 약 58,000개 (많은 데이터)<br/>
                • <strong>500페이지</strong>: 약 85,000개 (전체 수집 완료)<br/>
                <span className="fw-bold text-success">💡 전체 데이터 수집: 500페이지 입력</span>
              </small>
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
                <option value="sequential">순차 수집 (안정적)</option>
                <option value="parallel">병렬 수집 (빠름)</option>
            </CFormSelect>
              <small className="text-muted">
                • <strong>순차 수집</strong>: API를 하나씩 차례로 호출 (안정적, 서버 부담 적음)<br/>
                • <strong>병렬 수집</strong>: 여러 API를 동시에 호출 (빠름, 서버 부담 있음)
              </small>
          </CCol>
        </CRow>
          
        <CRow className="mt-3">
          <CCol md={12}>
              <CFormCheck
                checked={collectionConfig.incremental}
                onChange={(e) => setCollectionConfig({
                  ...collectionConfig,
                  incremental: e.target.checked
                })}
                label="스마트 업데이트 (권장)"
              />
              <small className="text-muted">
                • <strong>체크함</strong>: 변경된 데이터만 업데이트하여 효율적으로 동기화합니다<br/>
                • <strong>체크 안 함</strong>: 모든 데이터를 새로 덮어써서 강제로 동기화합니다<br/>
                <em>※ 두 경우 모두 API에서는 모든 데이터를 가져옵니다. 차이는 저장 방식입니다.</em>
              </small>
            </CCol>
          </CRow>
          
          <CRow className="mt-4">
            <CCol md={12}>
              <div className="alert alert-info">
                <strong>권장 설정</strong><br/>
                • <strong>빠른 테스트</strong>: 최대 페이지 5개, 순차 수집, 스마트 업데이트 ON<br/>
                • <strong>일반적인 수집</strong>: 최대 페이지 50~100개, 순차 수집, 스마트 업데이트 ON<br/>
                • <strong>전체 데이터 수집</strong>: 최대 페이지 500개, 순차 수집, 스마트 업데이트 OFF<br/>
                <small className="text-muted">
                  ※ 전체 약 85,000개 데이터 수집 완료까지 500페이지 필요<br/>
                </small>
            </div>
          </CCol>
        </CRow>

          {/* 수집 진행 상황 표시 */}
          {collectionProgress && (
            <CRow className="mt-4">
              <CCol md={12}>
                <div className="alert alert-primary">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">수집 진행 중</h6>
                    <span className="badge bg-primary">
                      {collectionProgress.current || 0}/{collectionProgress.total || 1}
                    </span>
                  </div>
                  
                  <CProgress className="mb-2" height={15}>
                    <CProgressBar 
                      value={collectionProgress.percentage || 0}
                      color={
                        collectionProgress.hasErrors ? 'danger' : 
                        collectionProgress.completed ? 'success' : 'primary'
                      }
                      animated={!collectionProgress.completed && !collectionProgress.hasErrors}
                    >
                      {collectionProgress.percentage || 0}%
                    </CProgressBar>
                  </CProgress>
                  
                  <div className="d-flex align-items-center">
                    {collectionProgress.completed ? (
                      <span className="text-success me-2">완료</span>
                    ) : collectionProgress.hasErrors ? (
                      <span className="text-danger me-2">오류</span>
                    ) : (
                      <CSpinner size="sm" className="me-2" />
                    )}
                    <span>{collectionProgress.status}</span>
                  </div>
                </div>
              </CCol>
            </CRow>
          )}


      </CModalBody>
      <CModalFooter>
        <CButton 
          color="secondary" 
          onClick={() => {
            console.log('모달 닫기 버튼 클릭')
            setIsDragging(false)
            
            if (collectionProgress && !collectionProgress.completed) {
              // 진행 중인 경우 강제 중단
              console.log('진행 중인 수집 강제 중단')
              forceStopAllCollections()
            } else {
              // 진행 중이 아닌 경우 모달 닫기 + 데이터 새로고침
              console.log('모달 닫기 및 데이터 새로고침')
              setCollectionModal(false)
              setCurrentProgressId(null)
              setCollectionProgress(null) 
              setCollectionResult(null)
              setIsDragging(false)
              setError(null)
              
              // 수집 완료 후 모달 닫기 시에만 데이터 새로고침
              setTimeout(async () => {
                try {
                  console.log('수집 완료 후 상태 새로고침 시작')
                  await loadSystemStatus()
                  if (activeTab === 'data') {
                    await loadCollectedData()
                  }
                  console.log('수집 완료 후 상태 새로고침 완료')
                } catch (err) {
                  console.error('모달 닫기 후 새로고침 실패:', err)
                  setError('데이터를 새로고침하는데 실패했습니다. 페이지를 새로고침해보세요.')
                }
              }, 300)
            }
          }}
          disabled={isCancelling}
          className="me-2"
        >
          {collectionProgress && !collectionProgress.completed ? '중단' : '닫기'}
        </CButton>
        <CButton 
          type="button"
          color="primary" 
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragging(false)
            startDataCollection()
          }}
          disabled={loading || collectionProgress?.percentage > 0}
        >
          {loading ? <CSpinner size="sm" className="me-2" /> : null}
          수집 시작
        </CButton>
      </CModalFooter>
    </CModal>
      </>
    )
  } catch (renderError) {
    console.error('CulturalHub 렌더링 에러:', renderError)
    return (
      <CRow>
        <CCol xs={12}>
          <CCard>
            <CCardBody>
              <CAlert color="danger">
                <h5>페이지 로딩 중 오류가 발생했습니다</h5>
                <p>페이지를 새로고침하거나 잠시 후 다시 시도해보세요.</p>
                <CButton 
                  color="primary" 
                  onClick={() => window.location.reload()}
                >
                  페이지 새로고침
                </CButton>
              </CAlert>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    )
  }
}

export default CulturalHub 