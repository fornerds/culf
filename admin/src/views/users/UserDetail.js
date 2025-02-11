import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CSpinner,
  CForm,
  CFormSelect,
  CFormInput,
  CFormCheck,
  CListGroup,
  CListGroupItem,
  CBadge,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CAlert,
} from '@coreui/react';
import { format } from 'date-fns';
import httpClient from '../../api/httpClient';

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [error, setError] = useState('');
  const [editData, setEditData] = useState({
    nickname: '',
    phone_number: '',
    birthdate: '',
    gender: '',
    marketing_agreed: false,
    is_corporate: false
  });

  useEffect(() => {
    fetchUserDetail();
  }, [id]);

  useEffect(() => {
    if (user) {
      setEditData({
        nickname: user.nickname || '',
        phone_number: user.phone_number || '',
        birthdate: user.birthdate || '',
        gender: user.gender || 'N',
        marketing_agreed: user.marketing_agreed || false,
        is_corporate: user.is_corporate || false
      });
    }
  }, [user]);

  const fetchUserDetail = async () => {
    try {
      setLoading(true);
      const { data } = await httpClient.get(`/admin/users/${id}`);
      setUser(data);
      setEditRole(data.role);
      setEditStatus(data.status);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    try {
      setError('');
      await httpClient.put(`admin/users/${id}`, editData);
      await fetchUserDetail();
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating user:', error);
      
      // 중복 에러 처리
      if (error.response?.data?.detail === "Nickname already exists") {
        setError('이미 사용중인 닉네임입니다.');
        return;
      }
      
      if (error.response?.data?.detail === "Phone number already exists") {
        setError('이미 사용중인 전화번호입니다.');
        return;
      }
      
      // validation 에러 처리
      if (error.response?.data?.details) {
        const details = error.response.data.details;
        const errorMessages = details.map(detail => {
          const fieldErrors = {
            phone_number: '전화번호는 10-11자리 숫자로 입력해주세요',
            nickname: '닉네임은 2-50자 사이로 입력해주세요',
          };
  
          const field = detail.loc[1];
          return fieldErrors[field] || detail.msg;
        });
  
        setError(errorMessages.join('\n'));
      } else if (error.response?.data?.detail) {
        // 기타 서버 에러 메시지 처리
        setError(error.response.data.detail);
      } else {
        setError('사용자 정보 수정 중 오류가 발생했습니다.');
      }
    }
  };

  const handleRoleChange = async () => {
    try {
      await httpClient.put(`/admin/users/${id}/role`, { role: editRole });
      await fetchUserDetail();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleStatusChange = async () => {
    try {
      await httpClient.put(`/admin/users/${id}/status`, { status: editStatus });
      await fetchUserDetail();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await httpClient.delete(`/admin/users/${id}`);
      await fetchUserDetail();
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      ACTIVE: { color: 'success', label: '활성' },
      BANNED: { color: 'danger', label: '차단' },
      WITHDRAWN: { color: 'dark', label: '비활성' }
    };
    const statusInfo = statusMap[status] || { color: 'secondary', label: '알 수 없음' };
    return <CBadge color={statusInfo.color}>{statusInfo.label}</CBadge>;
  };

  if (loading) {
    return (
      <div className="text-center">
        <CSpinner color="primary" />
      </div>
    );
  }

  if (!user) {
    return <div>사용자를 찾을 수 없습니다.</div>;
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <strong>사용자 상세 정보</strong>
            <div>
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
                className="me-2"
                disabled={user.status === 'WITHDRAWN'}
              >
                정보 수정
              </CButton>
              <CButton
                color="danger"
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="me-2"
              >
                계정 비활성화
              </CButton>
              <CButton
                color="secondary"
                size="sm"
                onClick={() => navigate('/users')}
              >
                목록으로 돌아가기
              </CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <div className="mb-4">
              <h5>기본 정보</h5>
              <CListGroup>
                <CListGroupItem>
                  <div className="fw-bold">이메일</div>
                  {user.email}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">닉네임</div>
                  {user.nickname}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">전화번호</div>
                  {user.phone_number || '-'}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">생년월일</div>
                  {user.birthdate ? format(new Date(user.birthdate), 'yyyy-MM-dd') : '-'}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">성별</div>
                  {user.gender === 'M' ? '남성' : user.gender === 'F' ? '여성' : '미지정'}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">마케팅 동의</div>
                  {user.marketing_agreed ? '동의' : '미동의'}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">가입일</div>
                  {format(new Date(user.created_at), 'yyyy-MM-dd HH:mm:ss')}
                </CListGroupItem>
              </CListGroup>
            </div>

            <div className="mb-4">
              <h5>계정 상태</h5>
              <CListGroup>
                <CListGroupItem>
                  <div className="fw-bold">현재 상태</div>
                  <div className="d-flex align-items-center justify-content-between">
                    {getStatusBadge(user.status)}
                    <CForm className="d-flex align-items-center gap-2">
                      <CFormSelect
                        size="sm"
                        style={{ width: '150px' }}
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        disabled={user.status === 'WITHDRAWN'}
                      >
                        <option value="ACTIVE">활성</option>
                        <option value="BANNED">차단</option>
                      </CFormSelect>
                      <CButton
                        color="primary"
                        size="sm"
                        onClick={handleStatusChange}
                        disabled={user.status === 'WITHDRAWN'}
                      >
                        변경
                      </CButton>
                    </CForm>
                  </div>
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">권한</div>
                  <div className="d-flex align-items-center justify-content-between">
                    <CBadge color="info">{user.role}</CBadge>
                    <CForm className="d-flex align-items-center gap-2">
                      <CFormSelect
                        size="sm"
                        style={{ width: '150px' }}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        disabled={user.status === 'WITHDRAWN'}
                      >
                        <option value="USER">일반사용자</option>
                        <option value="ADMIN">관리자</option>
                        <option value="SUPERUSER">슈퍼유저</option>
                      </CFormSelect>
                      <CButton
                        color="primary"
                        size="sm"
                        onClick={handleRoleChange}
                        disabled={user.status === 'WITHDRAWN'}
                      >
                        변경
                      </CButton>
                    </CForm>
                  </div>
                </CListGroupItem>
              </CListGroup>
            </div>

            <div className="mb-4">
              <h5>스톤 정보</h5>
              <CListGroup>
                <CListGroupItem>
                  <div className="fw-bold">스톤 잔액</div>
                  {user.token_info.total_tokens.toLocaleString()}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">사용한 스톤</div>
                  {user.token_info.used_tokens.toLocaleString()}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">월간 스톤 사용량</div>
                  {user.token_info.monthly_token_usage.toLocaleString()}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">마지막 충전일</div>
                  {user.token_info.last_charged_at
                    ? format(new Date(user.token_info.last_charged_at), 'yyyy-MM-dd HH:mm:ss')
                    : '-'
                  }
                </CListGroupItem>
              </CListGroup>
            </div>

            <div className="mb-4">
              <h5>결제 정보</h5>
              <CListGroup>
                <CListGroupItem>
                  <div className="fw-bold">총 결제 금액</div>
                  {user.payment_info.total_payment.toLocaleString()}원
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">월간 결제 금액</div>
                  {user.payment_info.monthly_payment.toLocaleString()}원
                </CListGroupItem>
              </CListGroup>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      {/* 수정 모달 */}
      <CModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>사용자 정보 수정</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <CAlert color="danger" className="mb-3">
              {error}
            </CAlert>
          )}
          <CForm>
            <div className="mb-3">
              <label className="form-label">닉네임</label>
              <CFormInput
                type="text"
                value={editData.nickname}
                onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                placeholder="닉네임을 입력하세요"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">전화번호</label>
              <CFormInput
                type="text"
                value={editData.phone_number}
                onChange={(e) => {
                  // 숫자만 허용
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  // 최대 11자리까지만 입력
                  if (value.length <= 11) {
                    setEditData({ ...editData, phone_number: value });
                  }
                }}
                isInvalid={editData.phone_number && !/^\d{10,11}$/.test(editData.phone_number)}
                placeholder="전화번호를 입력하세요 (숫자만 10-11자리)"
              />
              {editData.phone_number && !/^\d{10,11}$/.test(editData.phone_number) && (
                <div className="invalid-feedback">
                  전화번호는 10-11자리 숫자로 입력해주세요
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">생년월일</label>
              <CFormInput
                type="date"
                value={editData.birthdate}
                onChange={(e) => setEditData({ ...editData, birthdate: e.target.value })}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">성별</label>
              <CFormSelect
                value={editData.gender}
                onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
              >
                <option value="M">남성</option>
                <option value="F">여성</option>
                <option value="N">미지정</option>
              </CFormSelect>
            </div>

            <div className="mb-3">
              <CFormCheck
                id="marketingAgreed"
                label="마케팅 수신 동의"
                checked={editData.marketing_agreed}
                onChange={(e) => setEditData({ ...editData, marketing_agreed: e.target.checked })}
              />
            </div>

            <div className="mb-3">
              <CFormCheck
                id="isCorporate"
                label="기업회원 여부"
                checked={editData.is_corporate}
                onChange={(e) => setEditData({ ...editData, is_corporate: e.target.checked })}
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowEditModal(false)}>
            취소
          </CButton>
          <CButton color="primary" onClick={handleEditSubmit}>
            저장
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      >
        <CModalHeader>
          <CModalTitle>계정 비활성화</CModalTitle>
        </CModalHeader>
        <CModalBody>
          정말로 이 계정을 비활성화하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowDeleteModal(false)}>
            취소
          </CButton>
          <CButton color="danger" onClick={handleDelete}>
            비활성화
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  );
};

export default UserDetail;