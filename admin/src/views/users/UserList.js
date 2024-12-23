import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
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
  CSpinner,
} from '@coreui/react'
import { format } from 'date-fns'
import httpClient from '../../api/httpClient'

const UserList = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await httpClient.get('/users')
      setUsers(response.data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateTimeStr) => {
    return format(new Date(dateTimeStr), 'yyyy-MM-dd HH:mm:ss')
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
            <strong>유저 목록</strong>
          </CCardHeader>
          <CCardBody>
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: '20%' }}>닉네임</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '20%' }}>이메일</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '20%' }}>핸드폰</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '15%' }}>성별</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: '25%' }}>가입일</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {users.map((user) => (
                  <CTableRow key={user.user_id}>
                    <CTableDataCell>{user.nickname || '-'}</CTableDataCell>
                    <CTableDataCell>{user.email || '-'}</CTableDataCell>
                    <CTableDataCell>{user.phone || '-'}</CTableDataCell>
                    <CTableDataCell>
                      {user.gender === 'M' ? '남성' : user.gender === 'F' ? '여성' : '-'}
                    </CTableDataCell>
                    <CTableDataCell>{formatDateTime(user.created_at)}</CTableDataCell>
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

export default UserList
