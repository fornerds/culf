-- Custom ENUM types
CREATE TYPE gender_enum AS ENUM ('M', 'F', 'N');
CREATE TYPE status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'BANNED', 'DELETE');
CREATE TYPE role_enum AS ENUM ('USER', 'ADMIN');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE payment_status AS ENUM ('SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');
CREATE TYPE refund_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE discount_type AS ENUM ('RATE', 'AMOUNT');
CREATE TYPE inquiry_status AS ENUM ('PENDING', 'RESOLVED');
CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'ADMIN');
CREATE TYPE feedback_rating AS ENUM ('GOOD', 'BAD');

-- Users 테이블
CREATE TABLE Users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE,
    birthdate DATE NOT NULL,
    gender gender_enum DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    last_login_at TIMESTAMP,
    status status_enum NOT NULL DEFAULT 'ACTIVE',
    role role_enum NOT NULL DEFAULT 'USER',
    delete_reason VARCHAR(255),
    is_corporate BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_agreed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Curators 테이블
CREATE TABLE Curators (
    curator_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    profile_image VARCHAR(255),
    introduction TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Interests 테이블
CREATE TABLE User_Interests (
    user_id UUID REFERENCES Users(user_id),
    curator_id INTEGER REFERENCES Curators(curator_id),
    PRIMARY KEY (user_id, curator_id)
);

-- Conversations 테이블
CREATE TABLE Conversations (
    conversation_id CHAR(36) PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    question TEXT NOT NULL,
    question_summary TEXT,
    question_image VARCHAR(255),
    answer TEXT NOT NULL,
    answer_summary TEXT,
    question_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answer_time TIMESTAMP,
    tokens_used INTEGER NOT NULL DEFAULT 0
);

-- Tokens 테이블
CREATE TABLE tokens (
    token_id SERIAL PRIMARY KEY,  -- autoincrement를 위한 SERIAL 추가
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id), -- UUID는 unique constraint 적용
    total_tokens INTEGER NOT NULL DEFAULT 0,
    used_tokens INTEGER NOT NULL DEFAULT 0,
    last_charged_at TIMESTAMPTZ,  -- 시간대를 포함한 TIMESTAMP
    expires_at DATE
);

-- Token Usage History 테이블
CREATE TABLE Token_Usage_History (
    history_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    conversation_id CHAR(36) REFERENCES Conversations(conversation_id),
    tokens_used INTEGER NOT NULL DEFAULT 0,
    used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Plans 테이블
CREATE TABLE Subscription_Plans (
    plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discounted_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tokens_included INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    is_promotion BOOLEAN NOT NULL DEFAULT TRUE,
    promotion_details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Subscriptions 테이블
CREATE TABLE User_Subscriptions (
    subscription_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    plan_id INTEGER REFERENCES Subscription_Plans(plan_id),
    start_date DATE NOT NULL,
    next_billing_date DATE NOT NULL,
    status subscription_status NOT NULL DEFAULT 'ACTIVE'
);

-- Token Plans 테이블
CREATE TABLE Token_Plans (
    token_plan_id SERIAL PRIMARY KEY,
    tokens INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discounted_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    is_promotion BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Coupons 테이블
CREATE TABLE Coupons (
    coupon_id SERIAL PRIMARY KEY,
    coupon_code VARCHAR(20) UNIQUE NOT NULL,
    discount_type discount_type NOT NULL DEFAULT 'RATE',
    discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    max_usage INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0
);

-- Payments 테이블
CREATE TABLE Payments (
    payment_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    subscription_id BIGINT REFERENCES User_Subscriptions(subscription_id),
    token_plan_id INTEGER REFERENCES Token_Plans(token_plan_id),
    payment_number VARCHAR(20) UNIQUE NOT NULL,
    tokens_purchased INTEGER,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL,
    used_coupon_id INTEGER REFERENCES Coupons(coupon_id),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status payment_status NOT NULL DEFAULT 'FAILED',
    manual_payment_reason TEXT
);

-- Refunds 테이블
CREATE TABLE Refunds (
    refund_id SERIAL PRIMARY KEY,
    payment_id BIGINT REFERENCES Payments(payment_id),
    user_id UUID REFERENCES Users(user_id),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    status refund_status NOT NULL DEFAULT 'PENDING',
    processed_at TIMESTAMP,
    processed_by UUID REFERENCES Users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Coupons 테이블
CREATE TABLE User_Coupons (
    user_id UUID REFERENCES Users(user_id),
    coupon_id INTEGER REFERENCES Coupons(coupon_id),
    used_at TIMESTAMP,
    PRIMARY KEY (user_id, coupon_id)
);

-- Notices 테이블
CREATE TABLE Notices (
    notice_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT TRUE
);

-- User Notice Reads 테이블
CREATE TABLE User_Notice_Reads (
    user_id UUID REFERENCES Users(user_id),
    notice_id INTEGER REFERENCES Notices(notice_id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, notice_id)
);

-- Notifications 테이블
CREATE TABLE Notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- UserNotificationSettings 테이블
CREATE TABLE User_Notification_Settings (
    setting_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    notification_type VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

-- Inquiries 테이블
CREATE TABLE Inquiries (
    inquiry_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    attachment VARCHAR(255),
    status inquiry_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Admin Logs 테이블
CREATE TABLE Admin_Logs (
    log_id BIGSERIAL PRIMARY KEY,
    admin_id UUID REFERENCES Users(user_id),
    action VARCHAR(50) NOT NULL,
    target VARCHAR(255),
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Forbidden Words 테이블
CREATE TABLE Forbidden_Words (
    word_id SERIAL PRIMARY KEY,
    word VARCHAR(100) UNIQUE NOT NULL
);

-- UserBans 테이블
CREATE TABLE User_Bans (
    ban_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    reason TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP
);

-- CorporateUsers 테이블
CREATE TABLE Corporate_Users (
    user_id UUID PRIMARY KEY REFERENCES Users(user_id),
    company_name VARCHAR(255) NOT NULL,
    business_number VARCHAR(20),
    contact_person VARCHAR(50),
    contact_phone VARCHAR(20),
    address VARCHAR(255)
);

-- AdminUsers 테이블
CREATE TABLE Admin_Users (
    admin_id UUID PRIMARY KEY REFERENCES Users(user_id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role admin_role NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SystemSettings 테이블
CREATE TABLE System_Settings (
    setting_key VARCHAR(255) PRIMARY KEY,
    setting_value TEXT NOT NULL
);

-- Banners 테이블
CREATE TABLE Banners (
    banner_id SERIAL PRIMARY KEY,
    image_url VARCHAR(255) NOT NULL,
    target_url VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TermsAndConditions 테이블
CREATE TABLE Terms_And_Conditions (
    terms_id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    version VARCHAR(20) NOT NULL,
    effective_date DATE NOT NULL
);

-- ConversationFeedbacks 테이블
CREATE TABLE Conversation_Feedbacks (
    feedback_id BIGSERIAL PRIMARY KEY,
    conversation_id CHAR(36) REFERENCES Conversations(conversation_id),
    user_id UUID REFERENCES Users(user_id),
    rating feedback_rating,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users 테이블 mock 데이터
INSERT INTO users (user_id, email, password, nickname, phone_number, birthdate, gender, status, role) VALUES
('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', 'user1@example.com', 'hashedpassword1', '사용자1', '01012345678', '1990-01-01', 'M', 'ACTIVE', 'USER'),
('2c9e7bce-ccfe-5c3e-0c6e-bc9efcce5cfe', 'user2@example.com', 'hashedpassword2', '사용자2', '01023456789', '1992-02-02', 'F', 'ACTIVE', 'USER'),
('3d0f8cdf-ddff-6d4f-1d7f-cd0fgddf6dgf', 'admin@example.com', 'hashedpassword3', '관리자', '01034567890', '1988-03-03', 'N', 'ACTIVE', 'ADMIN');

-- Curators 테이블 mock 데이터
INSERT INTO curators (name, profile_image, introduction, category) VALUES
('여행 전문가', 'travel_expert.jpg', '세계 각국의 숨은 명소를 소개합니다.', '여행'),
('문화 큐레이터', 'culture_curator.jpg', '다양한 문화 행사와 전시회 정보를 제공합니다.', '문화'),
('예술 가이드', 'art_guide.jpg', '현대 미술부터 고전 예술까지 폭넓게 다룹니다.', '예술');

-- Conversations 테이블 mock 데이터
INSERT INTO conversations (conversation_id, user_id, question, answer, question_time, answer_time, tokens_used) VALUES
('4e1g9def-eeff-7e5g-2e8g-de1ghdef7ehg', '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', '파리에서 꼭 가봐야 할 곳은 어디인가요?', '파리에서 꼭 가봐야 할 곳은 에펠탑, 루브르 박물관, 개선문 등이 있습니다. 에펠탑은 파리의 상징적인 랜드마크로, 탑 위에서 파리 전경을 감상할 수 있습니다. 루브르 박물관은 세계적으로 유명한 미술관으로 모나리자 등 수많은 명작을 소장하고 있습니다. 개선문은 역사적 의미가 있는 건축물로, 그 주변의 샹젤리제 거리는 쇼핑과 카페 문화를 즐기기에 좋습니다.', '2023-09-15 10:00:00', '2023-09-15 10:00:30', 150),
('5f2h0efg-ffgg-8f6h-3f9h-ef2hiefg8fih', '2c9e7bce-ccfe-5c3e-0c6e-bc9efcce5cfe', '현재 서울에서 열리는 주목할 만한 전시회가 있나요?', '서울에서는 현재 여러 주목할 만한 전시회가 열리고 있습니다. 국립현대미술관에서는 현대 미술의 흐름을 보여주는 "한국 현대미술의 지평" 전시가 진행 중입니다. 서울시립미술관에서는 세계적인 아티스트 데미안 허스트의 개인전 "Natural History"가 열리고 있어 많은 관심을 받고 있습니다. 또한, 예술의전당에서는 "빈센트 반 고흐: 새로운 시각" 전시가 열려 고흐의 작품을 새로운 관점에서 감상할 수 있습니다.', '2023-09-16 14:30:00', '2023-09-16 14:30:45', 180);

-- Subscription_Plans 테이블 mock 데이터
INSERT INTO subscription_plans (plan_id, plan_name, price, discounted_price, tokens_included, description, is_promotion) VALUES
(1, '정기 구독', 20000, 15000, 0, '정기구독 플랜입니다.', true);


-- User_Subscriptions 테이블 mock 데이터
INSERT INTO user_subscriptions (user_id, plan_id, start_date, next_billing_date, status) VALUES
('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', 1, '2023-09-01', '2023-10-01', 'ACTIVE'),
('2c9e7bce-ccfe-5c3e-0c6e-bc9efcce5cfe', 1, '2023-08-15', '2023-09-15', 'ACTIVE');

-- Tokens 테이블 mock 데이터
INSERT INTO tokens (user_id, total_tokens, used_tokens, last_charged_at, expires_at) VALUES
('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', 100, 30, '2023-09-01', '2023-10-01'),
('2c9e7bce-ccfe-5c3e-0c6e-bc9efcce5cfe', 250, 80, '2023-08-15', '2023-09-15');

-- Notices 테이블 mock 데이터
INSERT INTO notices (title, content, image_url, start_date, end_date, view_count, is_public) VALUES
('서비스 업데이트 안내', '9월 20일부터 새로운 AI 모델이 적용됩니다. 더욱 정확하고 다양한 답변을 경험해보세요!', 'update_notice.jpg', '2023-09-15', '2023-09-30', 150, true),
('추석 연휴 고객센터 운영 안내', '추석 연휴 기간 동안 고객센터 운영 시간이 단축됩니다. 자세한 내용은 공지사항을 확인해주세요.', 'holiday_notice.jpg', '2023-09-25', '2023-10-05', 80, true);

-- Token plans 테이블 mock 데이터
INSERT INTO token_plans (tokens, price, discounted_price, discount_rate, is_promotion) VALUES
(50, 5000, 4000, 20.00, TRUE),
(100, 10000, 7500, 25.00, TRUE),
(200, 20000, 12000, 40.00, TRUE);