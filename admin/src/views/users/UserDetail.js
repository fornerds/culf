import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CSpinner,
  CListGroup,
  CListGroupItem,
  CBadge,
} from '@coreui/react'

const UserDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserDetail()
  }, [id])

  const fetchUserDetail = async () => {
    try {
      const response = await fetch(`/v1/admin/users/${id}`)
      if (response.ok) {
        const data = await response.json()
        setUser(data)
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (!user) {
    return <div>사용자를 찾을 수 없습니다.</div>
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>사용자 상세 정보</strong>
          </CCardHeader>
          <CCardBody>
            <CListGroup>
              <CListGroupItem>
                <div className="ms-2 me-auto">
                  <div className="fw-bold">이메일</div>
                  {user.email}
                </div>
              </CListGroupItem>
              <CListGroupItem>
                <div className="ms-2 me-auto">
                  <div className="fw-bold">이름</div>
                  {user.name}
                </div>
              </CListGroupItem>
              <CListGroupItem>
                <div className="ms-2 me-auto">
                  <div className="fw-bold">가입일</div>
                  {new Date(user.created_at).toLocaleString()}
                </div>
              </CListGroupItem>
              <CListGroupItem>
                <div className="ms-2 me-auto">
                  <div className="fw-bold">로그인 방식</div>
                  <CBadge color="info">{user.login_provider || '이메일'}</CBadge>
                </div>
              </CListGroupItem>
              <CListGroupItem>
                <div className="ms-2 me-auto">
                  <div className="fw-bold">상태</div>
                  <CBadge color={user.is_active ? 'success' : 'danger'}>
                    {user.is_active ? '활성' : '비활성'}
                  </CBadge>
                </div>
              </CListGroupItem>
              <CListGroupItem>
                <div className="ms-2 me-auto">
                  <div className="fw-bold">마지막 로그인</div>
                  {user.last_login ? new Date(user.last_login).toLocaleString() : '없음'}
                </div>
              </CListGroupItem>
            </CListGroup>
            <div className="mt-3">
              <CButton 
                color="secondary" 
                onClick={() => navigate('/users')}
              >
                목록으로 돌아가기
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default UserDetail
