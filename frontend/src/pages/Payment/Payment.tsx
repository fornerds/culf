import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayment } from '@/hooks/payment/usePayment';
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';

// Define your interfaces for product types
interface SubscriptionProduct {
  plan_id: number;
  plan_name: string;
  price: string;
  discounted_price: string;
  tokens_included: number;
  description: string;
  is_promotion: boolean;
  promotion_details: any;
  created_at: string;
  updated_at: string;
}

interface TokenProduct {
  token_plan_id: number;
  tokens: number;
  price: string;
  discounted_price: string;
  discount_rate: string;
  is_promotion: boolean;
  created_at: string;
  updated_at: string;
}

export function Pricing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'subscription' | 'token'>(
    'subscription',
  );

  // Use the products query directly from the usePayment hook
  const { products: productsQuery } = usePayment();

  // Handle loading state
  if (productsQuery.isLoading) {
    return (
      <div
        style={{
          marginTop: '250px',
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <LoadingAnimation
          imageUrl={logoimage}
          alt="로딩 이미지"
          width={58}
          height={19}
          duration={2200}
        />
        <p className="font-tag-1" style={{ color: '#a1a1a1' }}>
          로딩 중
        </p>
      </div>
    );
  }

  // Handle error state
  if (productsQuery.isError || !productsQuery.data) {
    return (
      <div
        style={{
          marginTop: '250px',
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <p className="font-tag-1" style={{ color: '#a1a1a1' }}>
          상품 정보를 불러올 수 없습니다.
        </p>
      </div>
    );
  }

  // Filter products based on activeTab
  const subscriptionProducts = productsQuery.data.filter(
    (product) => product.type === 'subscription',
  );

  const tokenProducts = productsQuery.data.filter(
    (product) => product.type === 'token',
  );

  // Handle product selection
  const handleSelectProduct = (
    productId: number,
    type: 'subscription' | 'token',
  ) => {
    navigate(`/payment/${type}/${productId}`);
  };

  return (
    <div className="pricing-container">
      {/* Tab Navigation */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'subscription' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscription')}
        >
          구독 플랜
        </button>
        <button
          className={`tab ${activeTab === 'token' ? 'active' : ''}`}
          onClick={() => setActiveTab('token')}
        >
          스톤 충전
        </button>
      </div>

      {/* Product Cards */}
      <div className="product-grid">
        {activeTab === 'subscription'
          ? subscriptionProducts.map((product) => (
              <div key={product.id} className="product-card">
                <h3>{product.name}</h3>
                <p className="price">
                  <span className="original">
                    {Number(product.price).toLocaleString()}원
                  </span>
                  <span className="discounted">
                    {Number(
                      product.price - product.price * 0.1,
                    ).toLocaleString()}
                    원
                  </span>
                </p>
                <p className="description">{product.description}</p>
                <button
                  onClick={() =>
                    handleSelectProduct(product.id, 'subscription')
                  }
                  className="select-button"
                >
                  선택하기
                </button>
              </div>
            ))
          : tokenProducts.map((product) => (
              <div key={product.id} className="product-card">
                <h3>{product.token_amount} 스톤</h3>
                <p className="price">
                  <span className="discounted">
                    {Number(product.price).toLocaleString()}원
                  </span>
                </p>
                <button
                  onClick={() => handleSelectProduct(product.id, 'token')}
                  className="select-button"
                >
                  충전하기
                </button>
              </div>
            ))}
      </div>
    </div>
  );
}

export default Pricing;
