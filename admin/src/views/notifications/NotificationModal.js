import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CForm,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CAlert
} from '@coreui/react';

const NotificationModal = ({
  visible,
  onClose,
  onCreate,
  users,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    type: 'SYSTEM_NOTICE',
    message: '',
    emails: ''
  });
  const [error, setError] = useState(null);
  const [parsedEmails, setParsedEmails] = useState({ valid: [], invalid: [] });

  const handleEmailsChange = (e) => {
    const inputValue = e.target.value;
    setFormData(prev => ({ ...prev, emails: inputValue }));
    
    // 이메일 파싱 및 검증
    const emailList = inputValue
      .split(/[\s,;\n]+/) // 공백, 쉼표, 세미콜론, 줄바꿈으로 구분
      .map(email => email.trim())
      .filter(email => email !== '');

    const validEmails = [];
    const invalidEmails = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    emailList.forEach(email => {
      if (emailRegex.test(email)) {
        validEmails.push(email);
      } else if (email !== '') {
        invalidEmails.push(email);
      }
    });

    setParsedEmails({ valid: validEmails, invalid: invalidEmails });
  };

  const handleSubmit = () => {
    // 유효한 이메일에 해당하는 user_id 찾기
    const selectedUserIds = users
      .filter(user => parsedEmails.valid.includes(user.email))
      .map(user => user.user_id);

    onCreate({
      type: formData.type,
      message: formData.message,
      user_ids: selectedUserIds.length > 0 ? selectedUserIds : [] // 빈 배열이면 전체 발송
    });
  };

  const handleClose = () => {
    setFormData({
      type: 'SYSTEM_NOTICE',
      message: '',
      emails: ''
    });
    setParsedEmails({ valid: [], invalid: [] });
    setError(null);
    onClose();
  };

  return (
    <CModal visible={visible} onClose={handleClose} size="lg">
      <CModalHeader>
        <CModalTitle>새 알림 생성</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CForm>
          <div className="mb-3">
            <CFormLabel>알림 유형</CFormLabel>
            <CFormSelect
              value={formData.type}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                type: e.target.value
              }))}
            >
              <option value="SYSTEM_NOTICE">시스템 공지</option>
              <option value="TOKEN_UPDATE">스톤 업데이트</option>
              <option value="CONTENT_UPDATE">콘텐츠 업데이트</option>
              <option value="PAYMENT_UPDATE">결제 업데이트</option>
            </CFormSelect>
          </div>
          
          <div className="mb-3">
            <CFormLabel>
              수신자 이메일
              <small className="text-muted ms-2">
                (엑셀에서 복사한 이메일을 붙여넣으세요)
              </small>
            </CFormLabel>
            <CFormTextarea
              value={formData.emails}
              onChange={handleEmailsChange}
              placeholder="user1@example.com&#13;&#10;user2@example.com&#13;&#10;..."
              rows={4}
            />
            {parsedEmails.valid.length > 0 && (
              <div className="mt-2 text-success">
                유효한 이메일 {parsedEmails.valid.length}개가 확인되었습니다.
              </div>
            )}
            {parsedEmails.invalid.length > 0 && (
              <CAlert color="warning" className="mt-2">
                {parsedEmails.invalid.length}개의 잘못된 형식의 이메일이 발견되었습니다:
                <br />
                {parsedEmails.invalid.join(', ')}
              </CAlert>
            )}
            <small className="text-muted mt-1 d-block">
              {formData.emails.trim() === '' 
                ? '이메일을 입력하지 않으면 전체 사용자에게 발송됩니다'
                : `${parsedEmails.valid.length}명의 사용자가 선택됨`}
            </small>
          </div>

          <div className="mb-3">
            <CFormLabel>알림 메시지</CFormLabel>
            <CFormTextarea
              placeholder="알림 메시지를 입력하세요..."
              value={formData.message}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                message: e.target.value
              }))}
              rows={3}
            />
          </div>
        </CForm>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={handleClose}>
          취소
        </CButton>
        <CButton 
          color="primary" 
          onClick={handleSubmit}
          disabled={!formData.message.trim() || loading}
        >
          {loading ? '처리중...' : '알림 생성'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default NotificationModal;