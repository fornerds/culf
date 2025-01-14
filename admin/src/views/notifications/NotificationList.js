// NotificationList.js
import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CButton,
  CSpinner,
  CBadge,
  CFormSelect,
  CFormInput,
  CPagination,
  CPaginationItem,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormTextarea,
  CFormLabel,
  CAlert,
  CFormCheck,
  CTooltip
} from '@coreui/react'
import { format } from 'date-fns'
import httpClient from '../../api/httpClient'

const NotificationList = () => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [newNotification, setNewNotification] = useState({
    type: 'SYSTEM_NOTICE',
    message: '',
    user_ids: []
  })
  const limit = 10

  useEffect(() => {
    fetchNotifications()
    fetchUsers()
  }, [currentPage, searchQuery])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await httpClient.get('/admin/notifications', {
        params: {
          page: currentPage,
          limit,
          search: searchQuery
        }
      })
      setNotifications(response.data.notifications)
      setTotalCount(response.data.total_count)
      setError(null)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      setError('알림 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await httpClient.get('/users', {
        params: { limit: 1000 }
      })
      setUsers(response.data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleCreateNotification = async () => {
    setShowConfirmModal(true)
  }

  const handleConfirmCreate = async () => {
    try {
      await httpClient.post('/admin/notifications', newNotification)
      setShowConfirmModal(false)
      setShowCreateModal(false)
      setNewNotification({
        type: 'SYSTEM_NOTICE',
        message: '',
        user_ids: []
      })
      fetchNotifications()
      setError(null)
    } catch (error) {
      console.error('Error creating notification:', error)
      setError('알림 생성에 실패했습니다.')
    }
  }

  const getTypeBadge = (type) => {
    const typeMap = {
      TOKEN_UPDATE: { color: 'info', label: '토큰 업데이트' },
      CONTENT_UPDATE: { color: 'success', label: '콘텐츠 업데이트' },
      PAYMENT_UPDATE: { color: 'warning', label: '결제 업데이트' },
      SYSTEM_NOTICE: { color: 'primary', label: '시스템 공지' }
    }
    const typeInfo = typeMap[type] || { color: 'secondary', label: '기타' }
    return <CBadge color={typeInfo.color}>{typeInfo.label}</CBadge>
  }

  const getReadStatus = (readCount, totalRecipients) => {
    const percentage = totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0
    let color = 'danger'
    if (percentage >= 90) color = 'success'
    else if (percentage >= 50) color = 'warning'
    
    return (
      <CTooltip 
        content={`전체 ${totalRecipients}명 중 ${readCount}명이 읽음`}
      >
        <CBadge color={color} className="px-2 py-1">
          {readCount}/{totalRecipients} ({percentage}%)
        </CBadge>
      </CTooltip>
    )
  }

  if (loading && notifications.length === 0) {
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
            <div className="d-flex justify-content-between align-items-center">
              <strong>알림 관리</strong>
              <CButton 
                color="primary"
                onClick={() => setShowCreateModal(true)}
              >
                알림 생성
              </CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{width: "15%"}}>유형</CTableHeaderCell>
                  <CTableHeaderCell style={{width: "40%"}}>메시지</CTableHeaderCell>
                  <CTableHeaderCell style={{width: "15%"}}>생성일시</CTableHeaderCell>
                  <CTableHeaderCell style={{width: "15%"}}>수신 대상</CTableHeaderCell>
                  <CTableHeaderCell style={{width: "15%"}}>읽음 상태</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {notifications.map((notification) => (
                  <CTableRow key={notification.notification_id}>
                    <CTableDataCell>
                      {getTypeBadge(notification.type)}
                    </CTableDataCell>
                    <CTableDataCell className="text-break">
                      {notification.message}
                    </CTableDataCell>
                    <CTableDataCell>
                      {format(new Date(notification.created_at), 'yyyy.MM.dd HH:mm')}
                    </CTableDataCell>
                    <CTableDataCell>
                      {notification.total_recipients === 0 ? 
                        <CBadge color="info">전체 사용자</CBadge> : 
                        `${notification.total_recipients}명`
                      }
                    </CTableDataCell>
                    <CTableDataCell>
                      {getReadStatus(notification.read_count, notification.total_recipients)}
                    </CTableDataCell>
                  </CTableRow>
                ))}
                {notifications.length === 0 && !loading && (
                  <CTableRow>
                    <CTableDataCell colSpan={5} className="text-center py-4">
                      알림이 없습니다.
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
            
            {loading && (
              <div className="text-center my-4">
                <CSpinner color="primary" />
              </div>
            )}

            {/* 페이지네이션 */}
            {totalCount > limit && (
              <CPagination align="center" className="mt-4">
                <CPaginationItem 
                  aria-label="Previous"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                >
                  이전
                </CPaginationItem>
                {Array.from({ length: Math.min(5, Math.ceil(totalCount / limit)) }, (_, i) => (
                  <CPaginationItem
                    key={i + 1}
                    active={currentPage === i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </CPaginationItem>
                ))}
                <CPaginationItem
                  aria-label="Next"
                  disabled={currentPage >= Math.ceil(totalCount / limit)}
                  onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / limit), currentPage + 1))}
                >
                  다음
                </CPaginationItem>
              </CPagination>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      {/* 알림 생성 모달 */}
      <CModal 
        visible={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>새 알림 생성</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>알림 유형</CFormLabel>
              <CFormSelect
                value={newNotification.type}
                onChange={(e) => setNewNotification({
                  ...newNotification,
                  type: e.target.value
                })}
              >
                <option value="SYSTEM_NOTICE">시스템 공지</option>
                <option value="TOKEN_UPDATE">토큰 업데이트</option>
                <option value="CONTENT_UPDATE">콘텐츠 업데이트</option>
                <option value="PAYMENT_UPDATE">결제 업데이트</option>
              </CFormSelect>
            </div>
            
            <div className="mb-3">
              <CFormLabel>수신자 선택</CFormLabel>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }} className="border rounded p-2">
                {users.map((user) => (
                  <div key={user.user_id} className="mb-2">
                    <CFormCheck
                      id={`user-${user.user_id}`}
                      label={`${user.nickname} (${user.email})`}
                      checked={newNotification.user_ids.includes(user.user_id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNewNotification(prev => ({
                          ...prev,
                          user_ids: checked 
                            ? [...prev.user_ids, user.user_id]
                            : prev.user_ids.filter(id => id !== user.user_id)
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <small className="text-muted mt-1 d-block">
                {newNotification.user_ids.length > 0 
                  ? `${newNotification.user_ids.length}명의 사용자가 선택됨` 
                  : '선택된 사용자가 없으면 전체 사용자에게 발송됩니다'}
              </small>
            </div>

            <div className="mb-3">
              <CFormLabel>알림 메시지</CFormLabel>
              <CFormTextarea
                placeholder="알림 메시지를 입력하세요..."
                value={newNotification.message}
                onChange={(e) => setNewNotification({
                  ...newNotification,
                  message: e.target.value
                })}
                rows={3}
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton 
            color="secondary" 
            onClick={() => setShowCreateModal(false)}
          >
            취소
          </CButton>
          <CButton 
            color="primary" 
            onClick={handleCreateNotification}
            disabled={!newNotification.message.trim()}
          >
            알림 생성
          </CButton>
        </CModalFooter>
      </CModal>

      {/* 알림 전송 확인 모달 */}
      <CModal 
        visible={showConfirmModal} 
        onClose={() => setShowConfirmModal(false)}
      >
        <CModalHeader>
          <CModalTitle>알림 전송 확인</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>다음 내용으로 알림을 전송하시겠습니까?</p>
          <div className="mt-3">
            <p><strong>알림 유형:</strong> {
              {
                'SYSTEM_NOTICE': '시스템 공지',
                'TOKEN_UPDATE': '토큰 업데이트',
                'CONTENT_UPDATE': '콘텐츠 업데이트',
                'PAYMENT_UPDATE': '결제 업데이트'
              }[newNotification.type]
            }</p>
            <p><strong>수신자:</strong> {
              newNotification.user_ids.length > 0 
                ? `선택된 ${newNotification.user_ids.length}명의 사용자` 
                : '전체 사용자'
            }</p>
            <p><strong>메시지:</strong></p>
            <div className="p-2 bg-light rounded">
              {newNotification.message}
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton 
            color="secondary" 
            onClick={() => setShowConfirmModal(false)}
          >
            취소
          </CButton>
          <CButton 
            color="primary" 
            onClick={handleConfirmCreate}
          >
            전송
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}

export default NotificationList