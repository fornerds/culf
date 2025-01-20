import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CButton,
  CSpinner,
  CInputGroup,
  CInputGroupText,
  CFormFeedback,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const UserCreate = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password_confirmation: '',
    nickname: '',
    phone_number: '',
    role: 'USER',
    status: 'ACTIVE',
    birthdate: '',
    gender: 'N',
  })

  const [validation, setValidation] = useState({
    email: { valid: true, message: '' },
    nickname: { valid: true, message: '' },
    password: { valid: true, message: '' }
  })

  // Password validation rules
  const passwordRules = {
    minLength: 8,
    hasNumber: /\d/,
    hasUpper: /[A-Z]/,
    hasLower: /[a-z]/,
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/
  }

  // 이메일 형식 검증
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/
    if (!email) return { valid: false, message: '이메일을 입력해주세요.' }
    if (!emailRegex.test(email)) return { valid: false, message: '올바른 이메일 형식이 아닙니다.' }
    return { valid: true, message: '' }
  }

  const validatePassword = (password) => {
    if (password.length < passwordRules.minLength) {
      return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' }
    }
    if (!passwordRules.hasNumber.test(password)) {
      return { valid: false, message: '숫자를 포함해야 합니다.' }
    }
    if (!passwordRules.hasUpper.test(password) || !passwordRules.hasLower.test(password)) {
      return { valid: false, message: '대문자와 소문자를 모두 포함해야 합니다.' }
    }
    if (!passwordRules.hasSpecial.test(password)) {
      return { valid: false, message: '특수문자를 포함해야 합니다.' }
    }
    return { valid: true, message: '' }
  }

  const checkEmailDuplicate = async () => {
    // 먼저 이메일 형식 검증
    const emailValidation = validateEmail(formData.email)
    if (!emailValidation.valid) {
      setValidation(prev => ({
        ...prev,
        email: emailValidation
      }))
      return false
    }

    try {
      setLoading(true)
      const response = await httpClient.post('/auth/check-email', {
        email: formData.email
      })
      const isAvailable = response.data.available
      const validationMessage = isAvailable ? 
        { valid: true, message: '사용 가능한 이메일입니다.', type: 'success' } :
        { valid: false, message: '이미 사용 중인 이메일입니다.', type: 'danger' }
      
      setValidation(prev => ({
        ...prev,
        email: validationMessage
      }))
      return isAvailable
    } catch (error) {
      console.error('Error checking email:', error)
      setValidation(prev => ({
        ...prev,
        email: { valid: false, message: '이메일 중복 확인 중 오류가 발생했습니다.', type: 'danger' }
      }))
      return false
    } finally {
      setLoading(false)
    }
  }

  const checkNicknameDuplicate = async () => {
    // 닉네임 길이 체크
    if (formData.nickname.length < 2 || formData.nickname.length > 50) {
      setValidation(prev => ({
        ...prev,
        nickname: { 
          valid: false, 
          message: '닉네임은 2자 이상 50자 이하여야 합니다.',
          type: 'danger'
        }
      }))
      return false
    }

    try {
      setLoading(true)
      const response = await httpClient.get(`/users/check-nickname/${formData.nickname}`)
      const isAvailable = !response.data.exists
      
      setValidation(prev => ({
        ...prev,
        nickname: {
          valid: isAvailable,
          message: isAvailable ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.',
          type: isAvailable ? 'success' : 'danger'
        }
      }))
      return isAvailable
    } catch (error) {
      console.error('Error checking nickname:', error)
      setValidation(prev => ({
        ...prev,
        nickname: { 
          valid: false, 
          message: '닉네임 중복 확인 중 오류가 발생했습니다.',
          type: 'danger'
        }
      }))
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Validate password
    const passwordValidation = validatePassword(formData.password)
    if (!passwordValidation.valid) {
      setValidation(prev => ({
        ...prev,
        password: passwordValidation
      }))
      setLoading(false)
      return
    }

    // Check if passwords match
    if (formData.password !== formData.password_confirmation) {
      setValidation(prev => ({
        ...prev,
        password: { valid: false, message: '비밀번호가 일치하지 않습니다.' }
      }))
      setLoading(false)
      return
    }

    // Check duplicates
    const emailAvailable = await checkEmailDuplicate()
    const nicknameAvailable = await checkNicknameDuplicate()

    if (!emailAvailable || !nicknameAvailable) {
      setLoading(false)
      return
    }

    try {
      await httpClient.post('/admin/users', formData)
      alert('사용자가 성공적으로 생성되었습니다.')
      navigate('/users', { replace: true })
    } catch (error) {
      console.error('Error creating user:', error)
      const errorMessage = error.response?.data?.message || '사용자 생성 중 오류가 발생했습니다.'
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>새 사용자 등록</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel htmlFor="email">이메일 *</CFormLabel>
                <CInputGroup>
                  <CFormInput
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value })
                      setValidation(prev => ({
                        ...prev,
                        email: { valid: true, message: '' }
                      }))
                    }}
                    invalid={!validation.email.valid}
                    required
                  />
                  <CButton 
                    type="button" 
                    color="info"
                    onClick={checkEmailDuplicate}
                    disabled={loading || !formData.email || !validateEmail(formData.email).valid}
                  >
                    {loading ? <CSpinner size="sm" /> : '중복확인'}
                  </CButton>
                  {validation.email.message && (
                    <div className={`invalid-feedback ${validation.email.type === 'success' ? 'text-success' : ''}`} style={{display: 'block'}}>
                      {validation.email.message}
                    </div>
                  )}
                </CInputGroup>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="password">비밀번호 *</CFormLabel>
                <CFormInput
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value })
                    setValidation(prev => ({
                      ...prev,
                      password: validatePassword(e.target.value)
                    }))
                  }}
                  invalid={!validation.password.valid}
                  required
                />
                <CFormFeedback invalid>{validation.password.message}</CFormFeedback>
                <small className="text-muted">
                  비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.
                </small>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="password_confirmation">비밀번호 확인 *</CFormLabel>
                <CFormInput
                  id="password_confirmation"
                  type="password"
                  value={formData.password_confirmation}
                  onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="nickname">닉네임 * (2-50자)</CFormLabel>
                <CInputGroup>
                  <CFormInput
                    id="nickname"
                    value={formData.nickname}
                    onChange={(e) => {
                      const newNickname = e.target.value
                      setFormData({ ...formData, nickname: newNickname })
                      setValidation(prev => ({
                        ...prev,
                        nickname: { valid: true, message: '', type: null }
                      }))
                    }}
                    invalid={validation.nickname.type === 'danger'}
                    valid={validation.nickname.type === 'success'}
                    required
                    maxLength={50}
                  />
                  <CButton 
                    type="button" 
                    color="info"
                    onClick={checkNicknameDuplicate}
                    disabled={loading || !formData.nickname || formData.nickname.length < 2}
                  >
                    {loading ? <CSpinner size="sm" /> : '중복확인'}
                  </CButton>
                  {validation.nickname.message && (
                    <div 
                      className={`${validation.nickname.type === 'success' ? 'valid-feedback' : 'invalid-feedback'}`} 
                      style={{display: 'block'}}
                    >
                      {validation.nickname.message}
                    </div>
                  )}
                </CInputGroup>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="phone">전화번호</CFormLabel>
                <CFormInput
                  id="phone"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="01012345678"
                />
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="birthdate">생년월일 *</CFormLabel>
                <CFormInput
                  id="birthdate"
                  type="date"
                  value={formData.birthdate}
                  onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="gender">성별 *</CFormLabel>
                <CFormSelect
                  id="gender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  required
                >
                  <option value="M">남성</option>
                  <option value="F">여성</option>
                  <option value="N">선택안함</option>
                </CFormSelect>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="role">권한 *</CFormLabel>
                <CFormSelect
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  <option value="USER">일반 사용자</option>
                  <option value="ADMIN">관리자</option>
                </CFormSelect>
              </div>

              {/* <div className="mb-3">
                <CFormLabel htmlFor="status">계정 상태 *</CFormLabel>
                <CFormSelect
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  required
                >
                  <option value="ACTIVE">활성화</option>
                  <option value="INACTIVE">비활성화</option>
                  <option value="BANNED">차단</option>
                </CFormSelect>
              </div> */}

              <div className="d-flex justify-content-center gap-3">
                <CButton 
                  type="submit" 
                  color="primary" 
                  className="px-5"
                  disabled={loading}
                >
                  {loading ? <CSpinner size="sm" /> : '생성'}
                </CButton>
                <CButton 
                  type="button" 
                  color="secondary" 
                  className="px-5"
                  onClick={() => navigate('/users')}
                  disabled={loading}
                >
                  취소
                </CButton>
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default UserCreate