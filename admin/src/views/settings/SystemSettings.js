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
  CFormCheck,
} from '@coreui/react';
import httpClient from '../../api/httpClient';
import { format } from 'date-fns';

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState('tokens');
  const [loading, setLoading] = useState(false);
  const [tokenPlans, setTokenPlans] = useState([]);
  const [products, setProducts] = useState({
    subscription_plans: [],
    token_plans: []
  });
  const [coupons, setCoupons] = useState([]);

  // Token Plan Form State
  const [tokenPlanForm, setTokenPlanForm] = useState({
    tokens: '',
    price: '',
    discounted_price: '',
    discount_rate: '',
    is_promotion: false
  });

  // Product Form State
  const [productForm, setProductForm] = useState({
    type: 'subscription',
    plan_name: '',
    description: '',
    price: '',
    tokens_included: '',
    discounted_price: '',
    is_promotion: false
  });

  // Coupon Form State
  const [couponForm, setCouponForm] = useState({
    coupon_code: '',
    discount_type: 'RATE',
    discount_value: '',
    valid_from: '',
    valid_to: '',
    max_usage: ''
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTokenPlans(),
        fetchProducts(),
        fetchCoupons()
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Token Plans API Calls
  const fetchTokenPlans = async () => {
    try {
      const response = await httpClient.get('/admin/settings/tokens');
      setTokenPlans(response.data);
    } catch (error) {
      console.error('Error fetching token plans:', error);
    }
  };

  const handleTokenPlanSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await httpClient.post('/admin/settings/tokens', tokenPlanForm);
      await fetchTokenPlans();
      setTokenPlanForm({
        tokens: '',
        price: '',
        discounted_price: '',
        discount_rate: '',
        is_promotion: false
      });
    } catch (error) {
      console.error('Error creating token plan:', error);
    } finally {
      setLoading(false);
    }
  };

  // Products API Calls
  const fetchProducts = async () => {
    try {
      const response = await httpClient.get('/payments/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (productForm.type === 'subscription') {
        await httpClient.post('/admin/subscription-plans', productForm);
      } else {
        await httpClient.post('/admin/token-plans', productForm);
      }
      await fetchProducts();
      setProductForm({
        type: 'subscription',
        plan_name: '',
        description: '',
        price: '',
        tokens_included: '',
        discounted_price: '',
        is_promotion: false
      });
    } catch (error) {
      console.error('Error creating product:', error);
    } finally {
      setLoading(false);
    }
  };

  // Coupons API Calls
  const fetchCoupons = async () => {
    try {
      const response = await httpClient.get('/admin/coupons');
      setCoupons(response.data);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

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
    } catch (error) {
      console.error('Error creating coupon:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      setLoading(true);
      switch (type) {
        case 'token':
          await httpClient.delete(`/admin/settings/tokens/${id}`);
          await fetchTokenPlans();
          break;
        case 'product':
          await httpClient.delete(`/admin/products/${id}`);
          await fetchProducts();
          break;
        case 'coupon':
          await httpClient.delete(`/admin/coupons/${id}`);
          await fetchCoupons();
          break;
      }
    } catch (error) {
      console.error('Error deleting item:', error);
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
                  onClick={() => setActiveTab('tokens')}
                  style={{ cursor: 'pointer' }}
                >
                  토큰 정책 설정
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink 
                  active={activeTab === 'products'}
                  onClick={() => setActiveTab('products')}
                  style={{ cursor: 'pointer' }}
                >
                  상품 관리
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink 
                  active={activeTab === 'coupons'}
                  onClick={() => setActiveTab('coupons')}
                  style={{ cursor: 'pointer' }}
                >
                  쿠폰 관리
                </CNavLink>
              </CNavItem>
            </CNav>

            {/* 토큰 정책 설정 */}
            {activeTab === 'tokens' && (
              <>
                <CForm onSubmit={handleTokenPlanSubmit} className="mb-4">
                  <CRow>
                    <CCol md={6}>
                      <CFormLabel>기본 지급 토큰</CFormLabel>
                      <CInputGroup className="mb-3">
                        <CFormInput
                          type="number"
                          value={tokenPlanForm.tokens}
                          onChange={(e) => setTokenPlanForm({ ...tokenPlanForm, tokens: e.target.value })}
                          required
                        />
                        <CInputGroupText>개</CInputGroupText>
                      </CInputGroup>
                    </CCol>
                    <CCol md={6}>
                      <CFormLabel>가격</CFormLabel>
                      <CInputGroup className="mb-3">
                        <CFormInput
                          type="number"
                          value={tokenPlanForm.price}
                          onChange={(e) => setTokenPlanForm({ ...tokenPlanForm, price: e.target.value })}
                          required
                        />
                        <CInputGroupText>원</CInputGroupText>
                      </CInputGroup>
                    </CCol>
                  </CRow>
                  <CButton type="submit" color="primary">
                    토큰 정책 추가
                  </CButton>
                </CForm>

                <CTable hover>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>토큰 수량</CTableHeaderCell>
                      <CTableHeaderCell>가격</CTableHeaderCell>
                      <CTableHeaderCell>할인가</CTableHeaderCell>
                      <CTableHeaderCell>할인율</CTableHeaderCell>
                      <CTableHeaderCell>작업</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {tokenPlans.map((plan) => (
                      <CTableRow key={plan.token_plan_id}>
                        <CTableDataCell>{plan.tokens}개</CTableDataCell>
                        <CTableDataCell>{plan.price.toLocaleString()}원</CTableDataCell>
                        <CTableDataCell>{plan.discounted_price?.toLocaleString()}원</CTableDataCell>
                        <CTableDataCell>{plan.discount_rate}%</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={plan.is_promotion ? 'success' : 'secondary'}>
                            {plan.is_promotion ? '진행중' : '종료'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton 
                            color="danger" 
                            size="sm"
                            onClick={() => handleDelete('product', plan.plan_id)}
                          >
                            삭제
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
                      <CTableHeaderCell>토큰 수량</CTableHeaderCell>
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
                        <CTableDataCell>{plan.price.toLocaleString()}원</CTableDataCell>
                        <CTableDataCell>{plan.discounted_price?.toLocaleString()}원</CTableDataCell>
                        <CTableDataCell>{plan.discount_rate}%</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={plan.is_promotion ? 'success' : 'secondary'}>
                            {plan.is_promotion ? '진행중' : '종료'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton 
                            color="danger" 
                            size="sm"
                            onClick={() => handleDelete('product', plan.token_plan_id)}
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

            {/* 쿠폰 관리 */}
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