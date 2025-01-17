import React, { useState, useEffect } from 'react'
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
 CListGroup,
 CListGroupItem,
 CFormFeedback,
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const PaymentCreate = () => {
 const navigate = useNavigate()
 const [loading, setLoading] = useState(false)
 const [formData, setFormData] = useState({
   user_id: '',
   payment_type: 'token', // 'token' or 'subscription'
   plan_id: '',
   manual_payment_reason: '',
 })
 const [searchTerm, setSearchTerm] = useState('')
 const [userSearchResults, setUserSearchResults] = useState([])
 const [userInfo, setUserInfo] = useState(null)
 const [validation, setValidation] = useState({
   user_id: { valid: true, message: '' },
   plan_id: { valid: true, message: '' },
   manual_payment_reason: { valid: true, message: '' }
 })
 const [plans, setPlans] = useState({
   token_plans: [],
   subscription_plans: [],
 })

 useEffect(() => {
   fetchPlans()
 }, [])

 const fetchPlans = async () => {
   try {
     const { data } = await httpClient.get('/payments/products')
     setPlans(data)
   } catch (error) {
     console.error('Error fetching plans:', error)
   }
 }

 const searchUser = async () => {
   if (!searchTerm.trim()) {
     setValidation(prev => ({
       ...prev,
       user_id: { valid: false, message: '검색어를 입력해주세요.' }
     }))
     return
   }

   try {
     setLoading(true)
     const { data } = await httpClient.get('/admin/users/search', {
       params: { query: searchTerm }
     })
     setUserSearchResults(data)
     if (data.length === 1) {
       setUserInfo(data[0])
       setFormData(prev => ({ ...prev, user_id: data[0].user_id }))
     }
   } catch (error) {
     console.error('Error searching users:', error)
     setValidation(prev => ({
       ...prev,
       user_id: { valid: false, message: '사용자 검색 중 오류가 발생했습니다.' }
     }))
     setUserInfo(null)
   } finally {
     setLoading(false)
   }
 }

 const handleSubmit = async (e) => {
   e.preventDefault()
   if (!formData.user_id) {
     setValidation(prev => ({
       ...prev,
       user_id: { valid: false, message: '사용자를 선택해주세요.' }
     }))
     return
   }

   if (!formData.plan_id) {
     setValidation(prev => ({
       ...prev,
       plan_id: { valid: false, message: '상품을 선택해주세요.' }
     }))
     return
   }

   if (!formData.manual_payment_reason) {
     setValidation(prev => ({
       ...prev,
       manual_payment_reason: { valid: false, message: '수동 결제 사유를 입력해주세요.' }
     }))
     return
   }

   try {
     setLoading(true)
     const requestData = {
       user_id: formData.user_id,
       manual_payment_reason: formData.manual_payment_reason,
       [formData.payment_type === 'token' ? 'token_plan_id' : 'subscription_id']: formData.plan_id,
     }
     
     await httpClient.post('/admin/payments', requestData)
     alert('수동 결제가 성공적으로 생성되었습니다.')
     navigate('/payments')
   } catch (error) {
     console.error('Error creating manual payment:', error)
     alert('수동 결제 생성에 실패했습니다.')
   } finally {
     setLoading(false)
   }
 }

 const handleSearchKeyPress = (e) => {
   if (e.key === 'Enter') {
     searchUser()
   }
 }

 return (
   <CRow>
     <CCol xs={12}>
       <CCard className="mb-4">
         <CCardHeader>
           <strong>수동 결제 생성</strong>
         </CCardHeader>
         <CCardBody>
           <CForm onSubmit={handleSubmit}>
             <div className="mb-3">
               <CFormLabel>사용자 검색</CFormLabel>
               <CInputGroup>
                 <CFormInput
                   value={searchTerm}
                   onChange={(e) => {
                     setSearchTerm(e.target.value)
                     setUserSearchResults([])
                   }}
                   onKeyPress={handleSearchKeyPress}
                   placeholder="이메일 또는 닉네임 입력"
                   invalid={!validation.user_id.valid}
                 />
                 <CButton 
                   type="button"
                   color="info"
                   onClick={searchUser}
                   disabled={loading}
                 >
                   {loading ? <CSpinner size="sm" /> : '검색'}
                 </CButton>
               </CInputGroup>
               {validation.user_id.message && (
                 <CFormFeedback invalid>
                   {validation.user_id.message}
                 </CFormFeedback>
               )}
               {userSearchResults.length > 0 && (
                 <CListGroup className="mt-2">
                   {userSearchResults.map(user => (
                     <CListGroupItem 
                       key={user.user_id}
                       onClick={() => {
                         setUserInfo(user)
                         setFormData(prev => ({ ...prev, user_id: user.user_id }))
                         setUserSearchResults([])
                         setSearchTerm('')
                       }}
                       style={{ cursor: 'pointer' }}
                     >
                       {user.nickname} ({user.email})
                     </CListGroupItem>
                   ))}
                 </CListGroup>
               )}
               {userInfo && (
                 <div className="mt-2 small text-medium-emphasis">
                   선택된 사용자: {userInfo.nickname} ({userInfo.email})
                 </div>
               )}
             </div>

             <div className="mb-3">
               <CFormLabel>결제 유형</CFormLabel>
               <CFormSelect
                 value={formData.payment_type}
                 onChange={(e) => {
                   setFormData({
                     ...formData,
                     payment_type: e.target.value,
                     plan_id: '',
                   })
                 }}
                 required
               >
                 <option value="token">스톤 결제</option>
                 <option value="subscription">구독 결제</option>
               </CFormSelect>
             </div>

             <div className="mb-3">
               <CFormLabel>상품 선택</CFormLabel>
               <CFormSelect
                 value={formData.plan_id}
                 onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                 invalid={!validation.plan_id.valid}
                 required
               >
                 <option value="">선택해주세요</option>
                 {formData.payment_type === 'token'
                   ? plans.token_plans.map((plan) => (
                       <option key={plan.token_plan_id} value={plan.token_plan_id}>
                         {plan.tokens}스톤 ({plan.price.toLocaleString()}원)
                       </option>
                     ))
                   : plans.subscription_plans.map((plan) => (
                       <option key={plan.plan_id} value={plan.plan_id}>
                         {plan.plan_name} ({plan.price.toLocaleString()}원/월)
                       </option>
                     ))}
               </CFormSelect>
               {!validation.plan_id.valid && (
                 <CFormFeedback invalid>
                   {validation.plan_id.message}
                 </CFormFeedback>
               )}
             </div>

             <div className="mb-3">
               <CFormLabel>수동 결제 사유</CFormLabel>
               <CFormInput
                 type="text"
                 value={formData.manual_payment_reason}
                 onChange={(e) => 
                   setFormData({ ...formData, manual_payment_reason: e.target.value })
                 }
                 invalid={!validation.manual_payment_reason.valid}
                 required
               />
               {!validation.manual_payment_reason.valid && (
                 <CFormFeedback invalid>
                   {validation.manual_payment_reason.message}
                 </CFormFeedback>
               )}
             </div>

             <div className="d-flex justify-content-center gap-3">
               <CButton 
                 type="submit" 
                 color="primary"
                 disabled={loading || !userInfo}
                 className="px-5"
               >
                 {loading ? <CSpinner size="sm" /> : '생성'}
               </CButton>
               <CButton
                 type="button"
                 color="secondary"
                 onClick={() => navigate('/payments')}
                 disabled={loading}
                 className="px-5"
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

export default PaymentCreate