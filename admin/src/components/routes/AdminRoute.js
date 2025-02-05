import React from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  
  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  // 관리자가 아닌 경우 403 페이지로 리다이렉트
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/403" replace />
  }
  
  return children
}

export default AdminRoute