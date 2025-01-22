import React, { useState, useEffect } from 'react';
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
  CFormTextarea,
  CButton,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CSpinner,
  CNav,
  CNavItem,
  CNavLink,
  CBadge,
  CInputGroup,
  CInputGroupText,
  CAlert,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormCheck,
  CPagination,
  CPaginationItem,
} from '@coreui/react';
import { cilCloudDownload, cilSearch } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import httpClient from '../../api/httpClient';
import { format } from 'date-fns';

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState('tokens');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [products, setProducts] = useState({
    subscription_plans: [],
    token_plans: []
  });
  const [message, setMessage] = useState({ type: '', content: '' });
  const [welcomeTokens, setWelcomeTokens] = useState('');
  const [grantTokenForm, setGrantTokenForm] = useState({
    email: '',
    amount: '',
    reason: ''
  });
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // 모달 관련 상태
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingProductType, setEditingProductType] = useState('');

  // 쿠폰 관련 상태
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({
    coupon_code: '',
    discount_type: 'RATE',
    discount_value: '',
    valid_from: '',
    valid_to: '',
    max_usage: ''
  });

  const [tokenGrants, setTokenGrants] = useState([]);
  const [tokenGrantsPage, setTokenGrantsPage] = useState(1);
  const [tokenGrantsTotal, setTokenGrantsTotal] = useState(0);
  const [tokenGrantsSearch, setTokenGrantsSearch] = useState('');
  const [tempTokenGrantsSearch, setTempTokenGrantsSearch] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWelcomeTokens(),
        fetchProducts(),
        fetchCoupons(),
        activeTab === 'token_grants' && fetchTokenGrants()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'token_grants') {
      fetchTokenGrants();
    }
  }, [activeTab, tokenGrantsPage, tokenGrantsSearch]);

  const searchUsers = async (email) => {
    if (!email) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data } = await httpClient.get('/admin/users', {
        params: {
          search: email,
          limit: 5
        }
      });
      setSearchResults(data.users);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleEmailSearch = (e) => {
    const email = e.target.value;
    setGrantTokenForm({ ...grantTokenForm, email });
    setSelectedUser(null);
    searchUsers(email);
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setGrantTokenForm({ ...grantTokenForm, email: user.email });
    setSearchResults([]);
  };

  const fetchTokenGrants = async () => {
    try {
      setLoading(true);
      const { data } = await httpClient.get('/admin/token-grants', {
        params: {
          page: tokenGrantsPage,
          limit: 10,
          search: tokenGrantsSearch
        }
      });
      setTokenGrants(data.token_grants);
      setTokenGrantsTotal(data.total_count);
    } catch (error) {
      console.error('Error fetching token grants:', error);
      setMessage({ type: 'danger', content: '토큰 지급 이력 조회에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // Welcome Tokens API Calls
  const fetchWelcomeTokens = async () => {
    try {
      const response = await httpClient.get('/admin/settings/welcome-tokens');
      setWelcomeTokens(response.data.welcome_tokens);
    } catch (error) {
      console.error('Error fetching welcome tokens:', error);
    }
  };

  const handleWelcomeTokensSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await httpClient.post('/admin/settings/welcome-tokens', { welcome_tokens: parseInt(welcomeTokens) });
      setMessage({ type: 'success', content: '가입 축하 스톤 설정이 저장되었습니다.' });
    } catch (error) {
      console.error('Error updating welcome tokens:', error);
      setMessage({ type: 'danger', content: '가입 축하 스톤 설정 저장에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // Grant Tokens API Call
  const handleGrantTokens = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await httpClient.post('/admin/users/grant-tokens', grantTokenForm);
      setMessage({ type: 'success', content: '스톤이 성공적으로 지급되었습니다.' });
      setGrantTokenForm({ email: '', amount: '', reason: '' });
      setSelectedUser(null);
    } catch (error) {
      console.error('Error granting tokens:', error);
      setMessage({ type: 'danger', content: '스톤 지급에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // Products API Calls
  const fetchProducts = async () => {
    try {
      const response = await httpClient.get('/payments/products');
      const sortedData = {
        subscription_plans: [...response.data.subscription_plans].sort((a, b) => a.price - b.price),
        token_plans: [...response.data.token_plans].sort((a, b) => a.price - b.price)
      };
      setProducts(sortedData);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // 상품 수정 관련 함수들
  const handleEdit = (product, type) => {
    setEditingProduct({ ...product });
    setEditingProductType(type);
    setEditModalVisible(true);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editingProductType === 'subscription') {
        await httpClient.put(`/admin/subscription-plans/${editingProduct.plan_id}`, editingProduct);
      } else {
        await httpClient.put(`/admin/token-plans/${editingProduct.token_plan_id}`, editingProduct);
      }
      await fetchProducts();
      setMessage({ type: 'success', content: '상품이 성공적으로 수정되었습니다.' });
      setEditModalVisible(false);
    } catch (error) {
      console.error('Error updating product:', error);
      setMessage({ type: 'danger', content: '상품 수정에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <CSpinner color="primary" />
      </div>
    );
  }


  // fetchCoupons 함수
  const fetchCoupons = async () => {
    try {
      const response = await httpClient.get('/admin/coupons');
      setCoupons(response.data);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

  // handleCouponSubmit 함수
  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await httpClient.post('/admin/coupons', couponForm);
      await fetchCoupons();
      setCouponForm({
        coupon_code: '',
        discount_type: 'RATE',
        discount_value: '',
        valid_from: '',
        valid_to: '',
        max_usage: ''
      });
      setMessage({ type: 'success', content: '쿠폰이 성공적으로 추가되었습니다.' });
    } catch (error) {
      console.error('Error creating coupon:', error);
      setMessage({ type: 'danger', content: '쿠폰 추가에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      setLoading(true);
      switch (type) {
        case 'coupon':
          await httpClient.delete(`/admin/coupons/${id}`);
          await fetchCoupons();
          setMessage({ type: 'success', content: '쿠폰이 성공적으로 삭제되었습니다.' });
          break;
        case 'product':
          await httpClient.delete(`/admin/products/${id}`);
          await fetchProducts();
          setMessage({ type: 'success', content: '상품이 성공적으로 삭제되었습니다.' });
          break;
        default:
          console.error('Invalid delete type');
          return;
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setMessage({ type: 'danger', content: '삭제에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>시스템 설정</strong>
          </CCardHeader>
          <CCardBody>
            <CNav variant="tabs" className="mb-4">
              <CNavItem>
                <CNavLink
                  active={activeTab === 'tokens'}
                  onClick={() => {
                    setActiveTab('tokens');
                    setMessage({ type: '', content: '' });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  스톤 관리
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink
                  active={activeTab === 'token_grants'}
                  onClick={() => {
                    setActiveTab('token_grants');
                    setMessage({ type: '', content: '' });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  스톤 지급 이력
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink
                  active={activeTab === 'products'}
                  onClick={() => {
                    setActiveTab('products');
                    setMessage({ type: '', content: '' });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  상품 관리
                </CNavLink>
              </CNavItem>

              <CNavItem>
                <CNavLink
                  active={activeTab === 'coupons'}
                  onClick={() => {
                    setActiveTab('coupons');
                    setMessage({ type: '', content: '' });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  쿠폰 관리
                </CNavLink>
              </CNavItem>
            </CNav>

            {message.content && (
              <CAlert color={message.type} className="mb-4">
                {message.content}
              </CAlert>
            )}

            {/* 스톤 정책 설정 탭 */}
            {activeTab === 'tokens' && (
              <>
                <h4 className="mb-4">가입 축하 스톤 설정</h4>
                <CForm onSubmit={handleWelcomeTokensSubmit} className="mb-4">
                  <CRow>
                    <CCol md={6}>
                      <CFormLabel>회원가입시 지급할 스톤</CFormLabel>
                      <CInputGroup className="mb-3">
                        <CFormInput
                          type="number"
                          value={welcomeTokens}
                          onChange={(e) => setWelcomeTokens(e.target.value)}
                          required
                        />
                        <CInputGroupText>개</CInputGroupText>
                      </CInputGroup>
                    </CCol>
                  </CRow>
                  <CButton type="submit" color="primary">
                    설정 저장
                  </CButton>
                </CForm>

                <h4 className="mb-4">스톤 지급</h4>
                <CForm onSubmit={handleGrantTokens} className="mb-4">
                  <CRow>
                    <CCol md={6}>
                      <CFormLabel>사용자 이메일</CFormLabel>
                      <CInputGroup className="mb-3">
                        <CFormInput
                          value={grantTokenForm.email}
                          onChange={handleEmailSearch}
                          required
                          placeholder="사용자 이메일을 입력하세요"
                        />
                        {searchLoading && (
                          <CInputGroupText>
                            <CSpinner size="sm" />
                          </CInputGroupText>
                        )}
                      </CInputGroup>
                      {searchResults.length > 0 && !selectedUser && (
                        <div className="position-relative">
                          <div className="position-absolute w-100 border rounded bg-white" style={{ zIndex: 1000 }}>
                            {searchResults.map((user) => (
                              <div
                                key={user.user_id}
                                className="p-2 cursor-pointer hover:bg-light border-bottom"
                                onClick={() => selectUser(user)}
                                style={{ cursor: 'pointer' }}
                              >
                                {user.email} ({user.nickname})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedUser && (
                        <div className="mb-3">
                          <small className="text-muted">
                            선택된 사용자: {selectedUser.nickname} (현재 스톤: {selectedUser.total_tokens?.toLocaleString() || 0}개)
                          </small>
                        </div>
                      )}
                    </CCol>
                    <CCol md={6}>
                      <CFormLabel>지급할 스톤</CFormLabel>
                      <CInputGroup className="mb-3">
                        <CFormInput
                          type="number"
                          value={grantTokenForm.amount}
                          onChange={(e) => setGrantTokenForm({ ...grantTokenForm, amount: e.target.value })}
                          required
                        />
                        <CInputGroupText>개</CInputGroupText>
                      </CInputGroup>
                    </CCol>
                  </CRow>
                  <CFormLabel>지급 사유</CFormLabel>
                  <CFormTextarea
                    className="mb-3"
                    value={grantTokenForm.reason}
                    onChange={(e) => setGrantTokenForm({ ...grantTokenForm, reason: e.target.value })}
                    required
                    rows={3}
                    placeholder="스톤 지급 사유를 입력하세요"
                  />
                  <CButton type="submit" color="primary" disabled={!selectedUser}>
                    스톤 지급
                  </CButton>
                </CForm>
              </>
            )}

            {/* 스톤 지급 이력 탭 */}
            {activeTab === 'token_grants' && (
              <>
                <div className="mb-3 d-flex justify-content-between align-items-center">
                  <div className="d-flex gap-2">
                    {/* 필요한 경우 여기에 필터 추가 */}
                  </div>
                  <CInputGroup style={{ width: '300px' }}>
                    <CFormInput
                      placeholder="검색어를 입력하세요"
                      value={tempTokenGrantsSearch}
                      onChange={(e) => setTempTokenGrantsSearch(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          setTokenGrantsSearch(tempTokenGrantsSearch);
                          setTokenGrantsPage(1);
                        }
                      }}
                    />
                    <CButton
                      color="primary"
                      variant="outline"
                      onClick={() => {
                        setTokenGrantsSearch(tempTokenGrantsSearch);
                        setTokenGrantsPage(1);
                      }}
                    >
                      <CIcon icon={cilSearch} />
                    </CButton>
                  </CInputGroup>
                </div>

                <CTable hover>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>지급일시</CTableHeaderCell>
                      <CTableHeaderCell>받은 사용자</CTableHeaderCell>
                      <CTableHeaderCell>지급 수량</CTableHeaderCell>
                      <CTableHeaderCell>지급 사유</CTableHeaderCell>
                      <CTableHeaderCell>지급한 관리자</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {tokenGrants.map((grant) => (
                      <CTableRow key={grant.token_grant_id}>
                        <CTableDataCell>
                          {format(new Date(grant.created_at), 'yyyy-MM-dd HH:mm:ss')}
                        </CTableDataCell>
                        <CTableDataCell>
                          {grant.user_nickname} ({grant.user_email})
                        </CTableDataCell>
                        <CTableDataCell>{grant.amount.toLocaleString()}개</CTableDataCell>
                        <CTableDataCell>{grant.reason}</CTableDataCell>
                        <CTableDataCell>{grant.admin_nickname}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <CPagination align="center" aria-label="Page navigation">
                  {/* 여러 페이지가 있는 경우에만 페이지네이션 표시 */}
                  {tokenGrantsTotal > 10 && (
                    <>
                      <CPaginationItem
                        aria-label="Previous"
                        disabled={tokenGrantsPage === 1}
                        onClick={() => setTokenGrantsPage((prev) => Math.max(1, prev - 1))}
                      >
                        <span aria-hidden="true">&laquo;</span>
                      </CPaginationItem>
                      {[...Array(Math.min(5, Math.ceil(tokenGrantsTotal / 10)))].map((_, i) => (
                        <CPaginationItem
                          key={i + 1}
                          active={i + 1 === tokenGrantsPage}
                          onClick={() => setTokenGrantsPage(i + 1)}
                        >
                          {i + 1}
                        </CPaginationItem>
                      ))}
                      <CPaginationItem
                        aria-label="Next"
                        disabled={tokenGrantsPage >= Math.ceil(tokenGrantsTotal / 10)}
                        onClick={() => setTokenGrantsPage((prev) => Math.min(Math.ceil(tokenGrantsTotal / 10), prev + 1))}
                      >
                        <span aria-hidden="true">&raquo;</span>
                      </CPaginationItem>
                    </>
                  )}
                </CPagination>
              </>
            )}

            {/* 상품 관리 탭 */}
            {activeTab === 'products' && (
              <>
                <h4>구독 상품 목록</h4>
                <CTable hover className="mb-4">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>상품명</CTableHeaderCell>
                      <CTableHeaderCell>가격</CTableHeaderCell>
                      <CTableHeaderCell>할인가</CTableHeaderCell>
                      <CTableHeaderCell>포함 스톤</CTableHeaderCell>
                      <CTableHeaderCell>프로모션</CTableHeaderCell>
                      <CTableHeaderCell>작업</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {products.subscription_plans.map((plan) => (
                      <CTableRow key={plan.plan_id}>
                        <CTableDataCell>{plan.plan_name}</CTableDataCell>
                        <CTableDataCell>{Math.floor(plan.price).toLocaleString()}원</CTableDataCell>
                        <CTableDataCell>{plan.discounted_price ? Math.floor(plan.discounted_price).toLocaleString() : '-'}원</CTableDataCell>
                        <CTableDataCell>{plan.tokens_included}개</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={plan.is_promotion ? 'success' : 'secondary'}>
                            {plan.is_promotion ? '진행중' : '종료'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton
                            color="primary"
                            size="sm"
                            onClick={() => handleEdit(plan, 'subscription')}
                          >
                            수정
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <h4>일반 상품 목록</h4>
                <CTable hover>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>스톤 수량</CTableHeaderCell>
                      <CTableHeaderCell>가격</CTableHeaderCell>
                      <CTableHeaderCell>할인가</CTableHeaderCell>
                      <CTableHeaderCell>할인율</CTableHeaderCell>
                      <CTableHeaderCell>프로모션</CTableHeaderCell>
                      <CTableHeaderCell>작업</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {products.token_plans.map((plan) => (
                      <CTableRow key={plan.token_plan_id}>
                        <CTableDataCell>{plan.tokens}개</CTableDataCell>
                        <CTableDataCell>{Math.floor(plan.price).toLocaleString()}원</CTableDataCell>
                        <CTableDataCell>{plan.discounted_price ? Math.floor(plan.discounted_price).toLocaleString() : '-'}원</CTableDataCell>
                        <CTableDataCell>{plan.discount_rate}%</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={plan.is_promotion ? 'success' : 'secondary'}>
                            {plan.is_promotion ? '진행중' : '종료'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton
                            color="primary"
                            size="sm"
                            onClick={() => handleEdit(plan, 'token')}
                          >
                            수정
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </>
            )}
            {/* 상품 수정 모달 */}
            <CModal
              visible={editModalVisible}
              onClose={() => setEditModalVisible(false)}
              backdrop="static"
              size="lg"
            >
              <CModalHeader closeButton>
                <CModalTitle>
                  {editingProductType === 'subscription' ? '구독 상품 수정' : '일반 상품 수정'}
                </CModalTitle>
              </CModalHeader>
              <CModalBody>
                {editingProduct && (
                  <CForm onSubmit={handleUpdateProduct}>
                    {editingProductType === 'subscription' ? (
                      // 구독 상품 수정 폼
                      <>
                        <CRow>
                          <CCol md={6}>
                            <CFormLabel>상품명</CFormLabel>
                            <CFormInput
                              className="mb-3"
                              value={editingProduct.plan_name}
                              onChange={(e) => setEditingProduct({
                                ...editingProduct,
                                plan_name: e.target.value
                              })}
                              required
                            />
                          </CCol>
                          <CCol md={6}>
                            <CFormLabel>스톤 수량</CFormLabel>
                            <CInputGroup className="mb-3">
                              <CFormInput
                                type="number"
                                value={editingProduct.tokens_included}
                                onChange={(e) => setEditingProduct({
                                  ...editingProduct,
                                  tokens_included: parseInt(e.target.value)
                                })}
                                required
                              />
                              <CInputGroupText>개</CInputGroupText>
                            </CInputGroup>
                          </CCol>
                        </CRow>

                        <CFormLabel>설명</CFormLabel>
                        <CFormTextarea
                          className="mb-3"
                          value={editingProduct.description}
                          onChange={(e) => setEditingProduct({
                            ...editingProduct,
                            description: e.target.value
                          })}
                          required
                          rows={3}
                        />
                      </>
                    ) : (
                      // 일반 상품 수정 폼
                      <CRow>
                        <CCol md={6}>
                          <CFormLabel>스톤 수량</CFormLabel>
                          <CInputGroup className="mb-3">
                            <CFormInput
                              type="number"
                              value={editingProduct.tokens}
                              onChange={(e) => setEditingProduct({
                                ...editingProduct,
                                tokens: parseInt(e.target.value)
                              })}
                              required
                            />
                            <CInputGroupText>개</CInputGroupText>
                          </CInputGroup>
                        </CCol>
                      </CRow>
                    )}

                    {/* 공통 필드 */}
                    <CRow>
                      <CCol md={6}>
                        <CFormLabel>가격</CFormLabel>
                        <CInputGroup className="mb-3">
                          <CFormInput
                            type="number"
                            value={Math.floor(editingProduct.price)}
                            onChange={(e) => setEditingProduct({
                              ...editingProduct,
                              price: parseInt(e.target.value)
                            })}
                            required
                          />
                          <CInputGroupText>원</CInputGroupText>
                        </CInputGroup>
                      </CCol>
                      <CCol md={6}>
                        <CFormLabel>할인가</CFormLabel>
                        <CInputGroup className="mb-3">
                          <CFormInput
                            type="number"
                            value={editingProduct.discounted_price ? Math.floor(editingProduct.discounted_price) : ''}
                            onChange={(e) => setEditingProduct({
                              ...editingProduct,
                              discounted_price: e.target.value ? parseInt(e.target.value) : null
                            })}
                          />
                          <CInputGroupText>원</CInputGroupText>
                        </CInputGroup>
                      </CCol>
                    </CRow>

                    {editingProductType === 'token' && (
                      <CRow>
                        <CCol md={6}>
                          <CFormLabel>할인율</CFormLabel>
                          <CInputGroup className="mb-3">
                            <CFormInput
                              type="number"
                              value={editingProduct.discount_rate || ''}
                              onChange={(e) => setEditingProduct({
                                ...editingProduct,
                                discount_rate: e.target.value ? parseFloat(e.target.value) : null
                              })}
                            />
                            <CInputGroupText>%</CInputGroupText>
                          </CInputGroup>
                        </CCol>
                      </CRow>
                    )}

                    <CFormCheck
                      id="edit-promotion"
                      label="프로모션 적용"
                      checked={editingProduct.is_promotion}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        is_promotion: e.target.checked
                      })}
                      className="mb-3"
                    />
                  </CForm>
                )}
              </CModalBody>
              <CModalFooter>
                <CButton color="secondary" onClick={() => setEditModalVisible(false)}>
                  취소
                </CButton>
                <CButton color="primary" onClick={handleUpdateProduct}>
                  수정 저장
                </CButton>
              </CModalFooter>
            </CModal>

            {/* 쿠폰 관리 탭 컨텐츠 */}
            {activeTab === 'coupons' && (
              <>
                <CForm onSubmit={handleCouponSubmit} className="mb-4">
                  <CRow>
                    <CCol md={6}>
                      <CFormLabel>쿠폰 코드</CFormLabel>
                      <CFormInput
                        className="mb-3"
                        value={couponForm.coupon_code}
                        onChange={(e) => setCouponForm({ ...couponForm, coupon_code: e.target.value })}
                        required
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormLabel>할인 유형</CFormLabel>
                      <CFormSelect
                        className="mb-3"
                        value={couponForm.discount_type}
                        onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                      >
                        <option value="RATE">비율 할인</option>
                        <option value="AMOUNT">금액 할인</option>
                      </CFormSelect>
                    </CCol>
                  </CRow>

                  <CRow>
                    <CCol md={4}>
                      <CFormLabel>할인 값</CFormLabel>
                      <CInputGroup className="mb-3">
                        <CFormInput
                          type="number"
                          value={couponForm.discount_value}
                          onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                          required
                        />
                        <CInputGroupText>
                          {couponForm.discount_type === 'RATE' ? '%' : '원'}
                        </CInputGroupText>
                      </CInputGroup>
                    </CCol>
                    <CCol md={4}>
                      <CFormLabel>유효 기간 시작</CFormLabel>
                      <CFormInput
                        type="date"
                        className="mb-3"
                        value={couponForm.valid_from}
                        onChange={(e) => setCouponForm({ ...couponForm, valid_from: e.target.value })}
                        required
                      />
                    </CCol>
                    <CCol md={4}>
                      <CFormLabel>유효 기간 종료</CFormLabel>
                      <CFormInput
                        type="date"
                        className="mb-3"
                        value={couponForm.valid_to}
                        onChange={(e) => setCouponForm({ ...couponForm, valid_to: e.target.value })}
                        required
                      />
                    </CCol>
                  </CRow>

                  <CFormLabel>최대 사용 횟수</CFormLabel>
                  <CFormInput
                    type="number"
                    className="mb-3"
                    value={couponForm.max_usage}
                    onChange={(e) => setCouponForm({ ...couponForm, max_usage: e.target.value })}
                  />

                  <CButton type="submit" color="primary">
                    쿠폰 추가
                  </CButton>
                </CForm>

                <CTable hover>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>쿠폰 코드</CTableHeaderCell>
                      <CTableHeaderCell>할인 유형</CTableHeaderCell>
                      <CTableHeaderCell>할인 값</CTableHeaderCell>
                      <CTableHeaderCell>유효 기간</CTableHeaderCell>
                      <CTableHeaderCell>최대 사용 횟수</CTableHeaderCell>
                      <CTableHeaderCell>사용된 횟수</CTableHeaderCell>
                      <CTableHeaderCell>작업</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {coupons.map((coupon) => (
                      <CTableRow key={coupon.coupon_id}>
                        <CTableDataCell>{coupon.coupon_code}</CTableDataCell>
                        <CTableDataCell>
                          {coupon.discount_type === 'RATE' ? '비율 할인' : '금액 할인'}
                        </CTableDataCell>
                        <CTableDataCell>
                          {coupon.discount_value}
                          {coupon.discount_type === 'RATE' ? '%' : '원'}
                        </CTableDataCell>
                        <CTableDataCell>
                          {format(new Date(coupon.valid_from), 'yyyy-MM-dd')} ~{' '}
                          {format(new Date(coupon.valid_to), 'yyyy-MM-dd')}
                        </CTableDataCell>
                        <CTableDataCell>{coupon.max_usage || '무제한'}</CTableDataCell>
                        <CTableDataCell>{coupon.used_count}</CTableDataCell>
                        <CTableDataCell>
                          <CButton
                            color="danger"
                            size="sm"
                            onClick={() => handleDelete('coupon', coupon.coupon_id)}
                          >
                            삭제
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </>
            )}

          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default SystemSettings;