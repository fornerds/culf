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
  CPagination,
  CPaginationItem,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CTooltip,
} from '@coreui/react'
import { format } from 'date-fns'
import httpClient from '../../api/httpClient'
import NotificationModal from './NotificationModal'
import ReadStatusModal from './ReadStatusModal'

const NotificationList = () => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [newNotification, setNewNotification] = useState(null)
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [showReadStatusModal, setShowReadStatusModal] = useState(false)
  const limit = 10

  useEffect(() => {
    fetchNotifications()
    fetchUsers()
  }, [currentPage])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await httpClient.get('/admin/notifications', {
        params: {
          page: currentPage,
          limit
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

  const handleCreateNotification = async (notificationData) => {
    setNewNotification(notificationData)
    setShowConfirmModal(true)
  }

  const handleConfirmCreate = async () => {
    try {
      setLoading(true)
      await httpClient.post('/admin/notifications', newNotification)
      setShowConfirmModal(false)
      setShowCreateModal(false)
      setNewNotification(null)
      fetchNotifications()
      setError(null)
    } catch (error) {
      console.error('Error creating notification:', error)
      setError('알림 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getTypeBadge = (type) => {
    const typeMap = {
      TOKEN_UPDATE: { color: 'info', label: '스톤 업데이트' },
      CONTENT_UPDATE: { color: 'success', label: '콘텐츠 업데이트' },
      PAYMENT_UPDATE: { color: 'warning', label: '결제 업데이트' },
      SYSTEM_NOTICE: { color: 'primary', label: '시스템 공지' }
    }
    const typeInfo = typeMap[type] || { color: 'secondary', label: '기타' }
    return <CBadge color={typeInfo.color}>{typeInfo.label}</CBadge>
  }

  const getReadStatus = (readCount, totalRecipients, notification) => {
    const percentage = totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0
    let color = 'danger'
    if (percentage >= 90) color = 'success'
    else if (percentage >= 50) color = 'warning'
    
    return (
      <CBadge 
        color={color} 
        className="px-2 py-1" 
        onClick={() => {
          setSelectedNotification(notification)
          setShowReadStatusModal(true)
        }}
        style={{ cursor: 'pointer' }}
      >
        {readCount}/{totalRecipients} ({percentage}%)
      </CBadge>
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
                      {getReadStatus(
                        notification.read_count, 
                        notification.total_recipients,
                        notification
                      )}
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
      <NotificationModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateNotification}
        users={users}
        loading={loading}
      />

      {/* 알림 전송 확인 모달 */}
      <CModal 
        visible={showConfirmModal} 
        onClose={() => setShowConfirmModal(false)}
      >
        <CModalHeader>
          <CModalTitle>알림 전송 확인</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {newNotification && (
            <>
              <p>다음 내용으로 알림을 전송하시겠습니까?</p>
              <div className="mt-3">
                <p><strong>알림 유형:</strong> {
                  {
                    'SYSTEM_NOTICE': '시스템 공지',
                    'TOKEN_UPDATE': '스톤 업데이트',
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
            </>
          )}
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
            disabled={loading}
          >
            {loading ? '전송 중...' : '전송'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* 읽음 상태 모달 */}
      <ReadStatusModal
        visible={showReadStatusModal}
        onClose={() => {
          setShowReadStatusModal(false);
          setSelectedNotification(null);
        }}
        notification={selectedNotification}
      />
    </CRow>
  )
}

export default NotificationList