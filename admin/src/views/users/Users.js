import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
  CBadge,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilUser } from '@coreui/icons'

const Users = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/v1/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      const response = await fetch(`/v1/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      })

      if (response.ok) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Error updating user status:', error)
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
            <strong>사용자 관리</strong>
          </CCardHeader>
          <CCardBody>
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>이메일</CTableHeaderCell>
                  <CTableHeaderCell>이름</CTableHeaderCell>
                  <CTableHeaderCell>가입일</CTableHeaderCell>
                  <CTableHeaderCell>로그인 방식</CTableHeaderCell>
                  <CTableHeaderCell>상태</CTableHeaderCell>
                  <CTableHeaderCell>관리</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {users.map((user) => (
                  <CTableRow key={user.user_id}>
                    <CTableDataCell>{user.email}</CTableDataCell>
                    <CTableDataCell>{user.name}</CTableDataCell>
                    <CTableDataCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color="info">{user.login_provider || '이메일'}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? '활성' : '비활성'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <Link to={`/users/${user.user_id}`}>
                        <CButton color="info" size="sm" className="me-2">
                          <CIcon icon={cilUser} />
                        </CButton>
                      </Link>
                      <CButton
                        color={user.is_active ? 'danger' : 'success'}
                        size="sm"
                        onClick={() => handleStatusToggle(user.user_id, user.is_active)}
                      >
                        {user.is_active ? '비활성화' : '활성화'}
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Users
