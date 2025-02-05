import React from 'react'
import {
  CButton,
  CCol,
  CContainer,
  CRow,
} from '@coreui/react'
import { useNavigate } from 'react-router-dom'

const Page403 = () => {
  const navigate = useNavigate()

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6}>
            <div className="clearfix">
              <h1 className="float-start display-3 me-4">403</h1>
              <h4 className="pt-3">접근 권한이 없습니다.</h4>
              <p className="text-body-secondary float-start">
                죄송합니다. 해당 페이지에 접근할 수 있는 권한이 없습니다.
              </p>
            </div>
            <CButton 
              color="info" 
              onClick={() => navigate('/login')}
              className="mt-3"
            >
              로그인 페이지로 이동
            </CButton>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Page403