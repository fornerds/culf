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
  
    const email = e.target.username.value // username을 email로 사용
    const password = e.target.password.value
  
    try {
      // 실제 로그인 API 호출
      const response = await httpClient.post('/auth/login', {
        email,
        password
      })
      
      // 응답에서 access_token 추출
      const { access_token } = response.data
      
      // 토큰 저장
      localStorage.setItem('token', access_token)
      
      // httpClient의 기본 헤더에 토큰 설정
      httpClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
      
      dispatch({ 
        type: 'LOGIN_SUCCESS', 
        payload: { username: email } 
      })
      
      navigate('/')
    } catch (error) {
      console.error('Login error:', error)
      setError('로그인 중 오류가 발생했습니다.')
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: error.response?.data?.detail || '로그인에 실패했습니다.' 
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
