import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser } from '@coreui/icons'
import httpClient from '../../../api/httpClient'

const Login = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const username = e.target.username.value
    const password = e.target.password.value

    // admin 계정 하드코딩 체크
    if (username === 'admin' && password === 'Culf123!@#') {
      try {
        // 실제 API 호출은 하지 않고 토큰만 저장
        const mockToken = 'mock_admin_token'
        localStorage.setItem('token', mockToken)
        
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: { username: 'admin' } 
        })
        
        // httpClient의 기본 헤더에 토큰 설정
        httpClient.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`
        
        navigate('/')
      } catch (error) {
        console.error('Login error:', error)
        setError('로그인 중 오류가 발생했습니다.')
      }
    } else {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: '로그인에 실패했습니다.' 
      })
    }
  }

  return (
    <div className="bg-light min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <CForm onSubmit={handleSubmit}>
                    <h1>로그인</h1>
                    <p className="text-medium-emphasis">관리자 계정으로 로그인하세요</p>
                    {error && (
                      <CAlert color="danger" className="mb-3">
                        {error}
                      </CAlert>
                    )}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        name="username"
                        placeholder="아이디"
                        autoComplete="username"
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        name="password"
                        type="password"
                        placeholder="비밀번호"
                        autoComplete="current-password"
                      />
                    </CInputGroup>
                    <CRow>
                      <CCol xs={6}>
                        <CButton type="submit" color="primary" className="px-4">
                          로그인
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login
