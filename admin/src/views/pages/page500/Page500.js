import React from 'react'
import {
  CButton,
  CCol,
  CContainer,
  CRow,
} from '@coreui/react'
import { useNavigate } from 'react-router-dom'

const Page500 = () => {
  const navigate = useNavigate()

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6}>
            <div className="clearfix">
              <h1 className="float-start display-3 me-4">500</h1>
              <h4 className="pt-3">서버 오류가 발생했습니다.</h4>
              <p className="text-body-secondary float-start">
                죄송합니다. 일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
              </p>
            </div>
            <CButton 
              color="info" 
              onClick={() => navigate('/')}
              className="mt-3"
            >
              메인 페이지로 이동
            </CButton>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Page500