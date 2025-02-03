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
  CListGroup,
  CListGroupItem,
  CBadge,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react';
import { format } from 'date-fns';
import httpClient from '../../api/httpClient';

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    fetchUserDetail();
  }, [id]);

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