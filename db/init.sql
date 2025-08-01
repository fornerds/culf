-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Custom ENUM types
CREATE TYPE gender_enum AS ENUM ('M', 'F', 'N');
CREATE TYPE status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'BANNED', 'WITHDRAWN');
CREATE TYPE role_enum AS ENUM ('USER', 'ADMIN', 'SUPERUSER');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE payment_status AS ENUM ('SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');
CREATE TYPE refund_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE discount_type AS ENUM ('RATE', 'AMOUNT');
CREATE TYPE inquiry_status AS ENUM ('PENDING', 'RESOLVED');
CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'ADMIN');
CREATE TYPE feedback_rating AS ENUM ('GOOD', 'BAD');
CREATE TYPE provider AS ENUM ('GOOGLE', 'KAKAO');

-- Users 테이블
CREATE TABLE Users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20), -- todo UNIQUE contraint 임시 제거
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
    marketing_agreed BOOLEAN NOT NULL DEFAULT FALSE,
    provider VARCHAR(50),
    provider_id VARCHAR(255) UNIQUE
);

-- UserProvider 테이블 정의
CREATE TABLE User_Provider (
    user_id UUID NOT NULL REFERENCES Users(user_id), -- 사용자 고유 ID (Users 테이블 참조)
    provider provider NOT NULL DEFAULT 'GOOGLE', -- Provider 이름(Google, Kakao)
    provider_id VARCHAR(255), -- Provider가 제공하는 서비스 유저 식별키
    PRIMARY KEY (user_id, provider_id) -- 복합 기본 키
);

-- Curators 테이블
CREATE TABLE Curators (
    curator_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    persona VARCHAR(100) NOT NULL,
    main_image VARCHAR(255),
    profile_image VARCHAR(255),
    introduction TEXT,
    category VARCHAR(50),
    background_color CHAR(7),
    text_color CHAR(7),
    shadow_color CHAR(7),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tags 테이블
CREATE TABLE Tags (
    tag_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- CuratorTagHistory 테이블
CREATE TABLE curator_tags_history (
    history_id SERIAL PRIMARY KEY,
    curator_id INTEGER NOT NULL REFERENCES curators(curator_id) ON DELETE CASCADE,
    tag_names JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Curator_Tags 중간 테이블
CREATE TABLE Curator_Tags (
    curator_id INTEGER REFERENCES Curators(curator_id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES Tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (curator_id, tag_id)
);

-- User Interests 테이블
CREATE TABLE User_Interests (
    user_id UUID REFERENCES Users(user_id),
    curator_id INTEGER REFERENCES Curators(curator_id),
    PRIMARY KEY (user_id, curator_id)
);

-- ChatRooms 테이블
CREATE TABLE Chat_Rooms (
    room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id),
    curator_id INTEGER NOT NULL REFERENCES Curators(curator_id),
    title VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    total_tokens_used INTEGER DEFAULT 0,
    conversation_count INTEGER DEFAULT 0,
    average_tokens_per_conversation NUMERIC(10, 2) DEFAULT 0.0,
    last_token_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_curator FOREIGN KEY (curator_id) REFERENCES Curators(curator_id) ON DELETE CASCADE
);

-- Conversations 테이블
CREATE TABLE Conversations (
    conversation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES Chat_Rooms(room_id),
    user_id UUID REFERENCES Users(user_id),
    question TEXT,
    question_summary TEXT,
    question_images JSONB,
    answer TEXT NOT NULL,
    answer_summary TEXT,
    question_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answer_time TIMESTAMP,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_chat_room FOREIGN KEY (room_id) REFERENCES Chat_Rooms(room_id) ON DELETE SET NULL,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_chat_rooms_user_id ON Chat_Rooms(user_id);
CREATE INDEX idx_chat_rooms_curator_id ON Chat_Rooms(curator_id);
CREATE INDEX idx_conversations_room_id ON Conversations(room_id);
CREATE INDEX idx_conversations_user_id ON Conversations(user_id);
CREATE INDEX idx_conversations_question_time ON Conversations(question_time);

-- updated_at을 자동으로 업데이트하기 위한 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_room_updated_at
    BEFORE UPDATE ON Chat_Rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Tokens 테이블
CREATE TABLE tokens (
    token_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id),
    total_tokens INTEGER NOT NULL DEFAULT 0,
    used_tokens INTEGER NOT NULL DEFAULT 0,
    tokens_expires_at DATE,
    last_charged_at TIMESTAMPTZ
);

-- Token Usage History 테이블
CREATE TABLE token_usage_history (
    history_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    conversation_id UUID REFERENCES Conversations(conversation_id),
    subscription_id REFERENCES User_subscriptions(subscription_id),
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
    subscription_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    plan_id INTEGER REFERENCES Subscription_Plans(plan_id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    next_billing_date DATE NOT NULL,
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    subscription_number VARCHAR(50) UNIQUE NULL,
    subscriptions_method VARCHAR(50) NOT NULL
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
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES Users(user_id),
    subscription_id BIGINT REFERENCES User_Subscriptions(subscription_id),
    token_plan_id INTEGER REFERENCES Token_Plans(token_plan_id),
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    transaction_number VARCHAR(50) UNIQUE NULL,
    tokens_purchased INTEGER,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL,
    used_coupon_id INTEGER REFERENCES Coupons(coupon_id),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status payment_status NOT NULL DEFAULT 'FAILED',
    manual_payment_reason TEXT
);

-- Payment Cache 테이블
CREATE TABLE Payment_Cache (
    cache_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    cid VARCHAR(50),
    tid VARCHAR(50) UNIQUE,
    partner_order_id VARCHAR(100),
    partner_user_id VARCHAR(100),
    subscription_id INTEGER REFERENCES User_Subscriptions(subscription_id),
    environment VARCHAR(20),
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour') NOT NULL,
    merchant_uid VARCHAR(50) UNIQUE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    token_plan_id INTEGER REFERENCES Token_Plans(token_plan_id),
    subscription_plan_id INTEGER REFERENCES Subscription_Plans(plan_id),
    coupon_id INTEGER REFERENCES Coupons(coupon_id)
);

-- User Coupons 테이블
CREATE TABLE User_Coupons (
    user_id UUID REFERENCES Users(user_id),
    coupon_id INTEGER REFERENCES Coupons(coupon_id),
    used_at TIMESTAMP,
    PRIMARY KEY (user_id, coupon_id)
);

-- Notices 테이블
CREATE TABLE notices (
    notice_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_important BOOLEAN DEFAULT FALSE
);

-- User Notice Reads 테이블
CREATE TABLE User_Notice_Reads (
    user_id UUID REFERENCES Users(user_id),
    notice_id INTEGER REFERENCES Notices(notice_id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, notice_id)
);

-- Notifications 테이블
CREATE TABLE Notifications (
    notification_id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- user_notifications 테이블
CREATE TABLE user_notifications (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    notification_id INTEGER REFERENCES notifications(notification_id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, notification_id)
);

-- UserNotificationSettings 테이블
CREATE TABLE User_Notification_Settings (
    setting_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

-- 인덱스 생성
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX idx_user_notifications_notification_id ON user_notifications(notification_id);
CREATE INDEX idx_user_notification_settings_user_id ON user_notification_settings(user_id);

-- Inquiries 테이블
CREATE TABLE Inquiries (
    inquiry_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id) NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB,
    status inquiry_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Refunds 테이블
CREATE TABLE Refunds (
    refund_id SERIAL PRIMARY KEY,
    payment_id UUID REFERENCES Payments(payment_id),
    user_id UUID REFERENCES Users(user_id),
    inquiry_id SERIAL REFERENCES Inquiries(inquiry_id),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    status refund_status NOT NULL DEFAULT 'PENDING',
    processed_at TIMESTAMP,
    processed_by UUID REFERENCES Users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Admin Logs 테이블
CREATE TABLE Admin_Logs (
    log_id SERIAL PRIMARY KEY,
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
CREATE TABLE system_settings (
    setting_id SERIAL PRIMARY KEY,
    key VARCHAR(50) NOT NULL UNIQUE,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Banners 테이블
CREATE TABLE Banners (
    banner_id SERIAL PRIMARY KEY,
    image_url VARCHAR(255) NOT NULL,
    target_url VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    click_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 배너 데이터 추가가
INSERT INTO Banners (banner_id, image_url, target_url, start_date, end_date, is_public, click_count, created_at, updated_at) VALUES (1, 'https://d21y711itn1wuo.cloudfront.net/banners/41289fdb-9476-4e65-97b5-83050a9e5330.png', 'http://culf.ai', '2025-01-01', '2030-12-10', true, 0, '2025-01-10 14:55:54.058594', '2025-01-10 14:55:54.058594');
INSERT INTO Banners (banner_id, image_url, target_url, start_date, end_date, is_public, click_count, created_at, updated_at) VALUES (2, 'https://d21y711itn1wuo.cloudfront.net/banners/4328f669-3066-47d9-bada-cc0247018d36.png', 'http://culf.ai', '2025-01-01', '2030-12-10', true, 0, '2025-01-10 14:56:40.849256', '2025-01-10 14:56:40.849256');
INSERT INTO Banners (banner_id, image_url, target_url, start_date, end_date, is_public, click_count, created_at, updated_at) VALUES (3, 'https://d21y711itn1wuo.cloudfront.net/banners/7cf06406-305f-4088-a8d9-9b70add696cc.png', 'http://culf.ai', '2025-01-01', '2030-12-10', true, 0, '2025-01-10 14:57:03.812885', '2025-01-10 14:57:03.812885');
INSERT INTO Banners (banner_id, image_url, target_url, start_date, end_date, is_public, click_count, created_at, updated_at) VALUES (4, 'https://d21y711itn1wuo.cloudfront.net/banners/da221356-16f8-4330-b9a6-970ebf960376.png', 'http://culf.ai', '2025-01-01', '2030-12-10', true, 0, '2025-01-10 14:57:23.905582', '2025-01-10 14:57:23.905582');

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
    feedback_id SERIAL PRIMARY KEY,
    conversation_id UUID REFERENCES Conversations(conversation_id),
    user_id UUID REFERENCES Users(user_id),
    rating feedback_rating,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 토큰 지급 내역을 위한 테이블
CREATE TABLE token_grants (
    token_grant_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    amount INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    granted_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_token_grants_user_id ON token_grants(user_id);
CREATE INDEX idx_token_grants_created_at ON token_grants(created_at);

-- Footer 정보를 저장할 테이블 생성
CREATE TABLE footers (
    footer_id SERIAL PRIMARY KEY,
    company_name VARCHAR(100) NOT NULL,          -- 상호: 주식회사 버킷래블
    ceo_name VARCHAR(50) NOT NULL,               -- 대표자: 명선아
    business_number VARCHAR(20) NOT NULL,        -- 사업자등록번호: 577-88-01749
    address TEXT NOT NULL,                       -- 주소: 서울시 중구 청계천로 40, 1305호
    email VARCHAR(100) NOT NULL,                 -- 이메일: culf.help@gmail.com
    customer_center_number VARCHAR(20) NOT NULL, -- 고객센터: 031-365-4520
    is_active BOOLEAN DEFAULT TRUE,              -- 현재 활성화된 푸터 여부
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 초기 데이터 삽입
INSERT INTO footers (
    company_name,
    ceo_name,
    business_number,
    address,
    email,
    customer_center_number
) VALUES (
    '주식회사 버킷래블',
    '명선아',
    '577-88-01749',
    '서울시 중구 청계천로 40, 1305호',
    'culf.help@gmail.com',
    '031-365-4520'
);

-- user_id 컬럼 타입 변경
ALTER TABLE users ALTER COLUMN "user_id" SET DATA TYPE uuid;

-- Users 테이블 mock 데이터
INSERT INTO Users (user_id, email, password, nickname, phone_number, birthdate, gender, status, role) VALUES
(uuid_generate_v4(), 'user1@example.com', 'hashedpassword1', '사용자1', '01012345678', '1990-01-01', 'M', 'ACTIVE', 'USER'),
(uuid_generate_v4(), 'user2@example.com', 'hashedpassword2', '사용자2', '01023456789', '1992-02-02', 'F', 'ACTIVE', 'USER'),
(uuid_generate_v4(), 'admin@example.com', 'hashedpassword3', '관리자', '01034567890', '1988-03-03', 'N', 'ACTIVE', 'ADMIN');
INSERT INTO users (user_id, email, password, nickname, phone_number, birthdate, gender, created_at, updated_at, deleted_at, last_login_at, status, role, delete_reason, is_corporate, marketing_agreed, provider, provider_id) VALUES ('d0d78f52-67fc-401b-8b90-791114b578bd', 'admin@culf.com', '$2b$12$JOQr4bGsquftq9C/onizk.g1888/jMF9pBj0t6lDLMmlAk/YpF6vq', 'Admin', '01012345678', '1990-01-01', 'N', '2024-12-12 13:38:22.157369', '2024-12-12 13:38:22.157369', NULL, NULL, 'ACTIVE', 'ADMIN', NULL, false, false, NULL, NULL);

INSERT INTO public.users
(user_id, email, "password", nickname, phone_number, birthdate, gender, created_at, updated_at, deleted_at, last_login_at, status, "role", delete_reason, is_corporate, marketing_agreed)
VALUES('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2'::uuid, 'culftester@culf.com', '$2b$12$wkT5HXS4TIhQAgruaHz/cuoqY/RPYnkQL/ewDHhwKK1dUfoRqc8l6', 'culftestnick', '01045678901', '1990-01-01', 'M'::public."gender_enum", '2024-11-04 11:01:18.603', '2024-11-04 11:01:18.603', NULL, NULL, 'ACTIVE'::public."status_enum", 'ADMIN'::public."role_enum", NULL, false, true);

-- Curators 테이블 mock 데이터
-- 새로운 태그 데이터 추가
INSERT INTO Tags (name) VALUES
('초보'),
('미술입문'),
('유럽'),
('인상주의'),
('동시대미술'),
('국내');

-- 새로운 큐레이터 데이터 추가
INSERT INTO Curators (name, persona, main_image, profile_image, introduction, category) VALUES
('네오', '지구 예술에 푹 빠진 외계인 네오', 'https://d21y711itn1wuo.cloudfront.net/curators/profile01.png', 'https://d21y711itn1wuo.cloudfront.net/curators/curator01.png', '처음 만나는 미술! 여러분과 함께 미술 세계를 탐험하고 싶어요.', '미술'),
('레미', '19세기 출신 파리지앵 레미', 'https://d21y711itn1wuo.cloudfront.net/curators/profile02.png', 'https://d21y711itn1wuo.cloudfront.net/curators/curator02.png', '인상주의 작품들과 유럽 미술을 소개해드립니다.', '미술'),
('두리', '감성 충만한 미술 애호가 두리', 'https://d21y711itn1wuo.cloudfront.net/curators/profile03.png', 'https://d21y711itn1wuo.cloudfront.net/curators/curator03.png', '한국의 현대미술과 동시대 작가들을 만나보세요.', '미술');

-- 큐레이터-태그 연결
-- 외계인 네오의 태그
INSERT INTO Curator_Tags (curator_id, tag_id)
SELECT c.curator_id, t.tag_id
FROM Curators c, Tags t
WHERE c.name = '네오' AND t.name IN ('초보', '미술입문');

-- 레미의 태그
INSERT INTO Curator_Tags (curator_id, tag_id)
SELECT c.curator_id, t.tag_id
FROM Curators c, Tags t
WHERE c.name = '레미' AND t.name IN ('유럽', '인상주의');

-- 두리의 태그
INSERT INTO Curator_Tags (curator_id, tag_id)
SELECT c.curator_id, t.tag_id
FROM Curators c, Tags t
WHERE c.name = '두리' AND t.name IN ('국내', '동시대미술');

-- Conversations 테이블 mock 데이터
INSERT INTO Conversations (conversation_id, user_id, question, answer, question_time, answer_time, tokens_used) VALUES
(uuid_generate_v4(), (SELECT user_id FROM Users WHERE email='user1@example.com'), '파리에서 꼭 가봐야 할 곳은 어디인가요?', '파리에서 꼭 가봐야 할 곳은 에펠탑, 루브르 박물관, 개선문 등이 있습니다. 에펠탑은 파리의 상징적인 랜드마크로, 탑 위에서 파리 전경을 감상할 수 있습니다. 루브르 박물관은 세계적으로 유명한 미술관으로 모나리자 등 수많은 명작을 소장하고 있습니다. 개선문은 역사적 의미가 있는 건축물로, 그 주변의 샹젤리제 거리는 쇼핑과 카페 문화를 즐기기에 좋습니다.', '2023-09-15 10:00:00', '2023-09-15 10:00:30', 150),
(uuid_generate_v4(), (SELECT user_id FROM Users WHERE email='user2@example.com'), '현재 서울에서 열리는 주목할 만한 전시회가 있나요?', '서울에서는 현재 여러 주목할 만한 전시회가 열리고 있습니다. 국립현대미술관에서는 현대 미술의 흐름을 보여주는 "한국 현대미술의 지평" 전시가 진행 중입니다. 서울시립미술관에서는 세계적인 아티스트 데미안 허스트의 개인전 "Natural History"가 열리고 있어 많은 관심을 받고 있습니다. 또한, 예술의전당에서는 "빈센트 반 고흐: 새로운 시각" 전시가 열려 고흐의 작품을 새로운 관점에서 감상할 수 있습니다.', '2023-09-16 14:30:00', '2023-09-16 14:30:45', 180);

-- Subscription_Plans 테이블 mock 데이터
INSERT INTO Subscription_Plans (plan_id, plan_name, price, discounted_price, tokens_included, description, is_promotion) VALUES (1, '베이직 구독', 9900, 9900, 100, '월 100스톤이 제공되는 베이직 구독 플랜입니다.', false), (2, '프리미엄 구독', 29900, 25000, 500, '월 500스톤이 제공되는 프리미엄 구독 플랜입니다.', true), (3, '프로페셔널 구독', 49900, 45000, 1000, '월 1000스톤이 제공되는 프로페셔널 구독 플랜입니다.', true);

-- Tokens 테이블 mock 데이터
INSERT INTO Tokens (user_id, total_tokens, used_tokens, tokens_expires_at, last_charged_at) VALUES ((SELECT user_id FROM Users WHERE email='user1@example.com'), 100, 50, '2028-09-01', '2023-09-01');

INSERT INTO Tokens (user_id, total_tokens, used_tokens, tokens_expires_at, last_charged_at) VALUES ((SELECT user_id FROM Users WHERE email='user2@example.com'), 250, 150, '2028-08-15', '2023-08-15');
-- Notices 테이블 mock 데이터
INSERT INTO Notices (title, content, image_url, start_date, end_date, view_count, is_public) VALUES
('서비스 업데이트 안내', '9월 20일부터 새로운 AI 모델이 적용됩니다. 더욱 정확하고 다양한 답변을 경험해보세요!', 'update_notice.jpg', '2023-09-15', '2023-09-30', 150, true),
('추석 연휴 고객센터 운영 안내', '추석 연휴 기간 동안 고객센터 운영 시간이 단축됩니다. 자세한 내용은 공지사항을 확인해주세요.', 'holiday_notice.jpg', '2023-09-25', '2023-10-05', 80, true);

-- Notifications 테이블 더미 데이터
INSERT INTO notifications (type, message, created_at) VALUES
('CONTENT_UPDATE', '새로운 큐레이션 콘텐츠가 업데이트되었습니다. 지금 확인해보세요!', NOW() - INTERVAL '1 day'),
('PAYMENT_UPDATE', '15,000원 결제가 완료되었습니다. 영수증을 확인해주세요.', NOW() - INTERVAL '3 days'),
('SYSTEM_NOTICE', '서비스 점검 안내: 내일 오전 2시부터 4시까지 서비스 점검이 있을 예정입니다.', NOW() - INTERVAL '12 hours'),
('TOKEN_UPDATE', '100개의 스톤이 사용되었습니다. 남은 스톤을 확인해보세요.', NOW() - INTERVAL '1 day'),
('CONTENT_UPDATE', '새로운 아티클 콘텐츠가 업데이트되었습니다. 지금 확인해보세요!', NOW() - INTERVAL '4 days'),
('PAYMENT_UPDATE', '30,000원 결제가 완료되었습니다. 영수증을 확인해주세요.', NOW() - INTERVAL '2 days'),
('SYSTEM_NOTICE', '새로운 기능 업데이트: 이제 음성으로도 대화를 나눌 수 있습니다!', NOW() - INTERVAL '8 hours');

-- Token plans 테이블 mock 데이터
INSERT INTO token_plans (tokens, price, discounted_price, discount_rate, is_promotion) VALUES
(50, 5000, 4000, 20.00, TRUE),
(100, 10000, 7500, 25.00, TRUE),
(200, 20000, 12000, 40.00, TRUE);

-- 베타 테스터 추가
INSERT INTO public.users
(user_id, email, "password", nickname, phone_number, birthdate, gender, created_at, updated_at, deleted_at, last_login_at, status, "role", delete_reason, is_corporate, marketing_agreed, "provider", provider_id)
VALUES('9bb162bd-3fce-4ff1-b615-f344be1c5632'::uuid, 'betauser1@culf.com', '$2b$12$EkkVkFKHJ.TWXoAXwPO3Z.naO2eH8dqnI/KivPSOsH46ms/9AU3qW', 'betatester', '01043219876', '2024-11-18', 'M'::public."gender_enum", '2024-11-18 14:19:25.832', '2024-11-18 14:19:25.832', NULL, NULL, 'ACTIVE'::public."status_enum", 'USER'::public."role_enum", NULL, false, false, NULL, NULL);
INSERT INTO public.users
(user_id, email, "password", nickname, phone_number, birthdate, gender, created_at, updated_at, deleted_at, last_login_at, status, "role", delete_reason, is_corporate, marketing_agreed, "provider", provider_id)
VALUES('88e3d350-0e4c-4ecd-96ad-3fbf27671499'::uuid, 'betauser2@culf.com', '$2b$12$nwaIuA2A6kgoBX7RCqd76OZqMHKJ39H.Th/SsAMcWqrCaF/PzrqUW', 'betatester2', '01054320987', '2024-11-18', 'M'::public."gender_enum", '2024-11-18 14:25:42.513', '2024-11-18 14:25:42.513', NULL, NULL, 'ACTIVE'::public."status_enum", 'USER'::public."role_enum", NULL, false, false, NULL, NULL);
INSERT INTO public.users
(user_id, email, "password", nickname, phone_number, birthdate, gender, created_at, updated_at, deleted_at, last_login_at, status, "role", delete_reason, is_corporate, marketing_agreed, "provider", provider_id)
VALUES('5c44c876-4b74-4596-a24d-d1c9ab7ca638'::uuid, 'betauser3@culf.com', '$2b$12$OfPZQHO4Ie4thKAJmQfj4uqzwdnPRwLJ0zHh9zh3p0.yGfRxSIUSa', 'betatester3', '01065431098', '2024-11-18', 'M'::public."gender_enum", '2024-11-18 14:36:51.351', '2024-11-18 14:36:51.351', NULL, NULL, 'ACTIVE'::public."status_enum", 'USER'::public."role_enum", NULL, false, false, NULL, NULL);


-- user_notifications mock 데이터 추가
INSERT INTO user_notifications (user_id, notification_id, is_read, read_at)
VALUES 
-- culftester의 알림
('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2', 1, true, CURRENT_TIMESTAMP - INTERVAL '12 hours'),
('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2', 2, true, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2', 3, false, NULL),
('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2', 4, false, NULL),

-- betatester1의 알림
('9bb162bd-3fce-4ff1-b615-f344be1c5632', 1, false, NULL),
('9bb162bd-3fce-4ff1-b615-f344be1c5632', 5, true, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('9bb162bd-3fce-4ff1-b615-f344be1c5632', 6, false, NULL),

-- betatester2의 알림
('88e3d350-0e4c-4ecd-96ad-3fbf27671499', 2, true, CURRENT_TIMESTAMP - INTERVAL '1 day'),
('88e3d350-0e4c-4ecd-96ad-3fbf27671499', 3, true, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
('88e3d350-0e4c-4ecd-96ad-3fbf27671499', 7, false, NULL),

-- betatester3의 알림
('5c44c876-4b74-4596-a24d-d1c9ab7ca638', 4, true, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('5c44c876-4b74-4596-a24d-d1c9ab7ca638', 5, false, NULL),
('5c44c876-4b74-4596-a24d-d1c9ab7ca638', 7, true, CURRENT_TIMESTAMP - INTERVAL '4 hours');

-- 고정 채팅방 생성
INSERT INTO Chat_Rooms (room_id, user_id, curator_id, title, is_active, created_at, updated_at) VALUES (
    'b39190ce-a097-4965-bf20-13100cb0420d'::uuid,  -- 고정된 UUID
    '1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2'::uuid,  -- culftester의 user_id
    3,'두리와의 대화', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Inquiry 데이터
INSERT INTO Inquiries (user_id, type, title, email, contact, content, status, created_at) VALUES ('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2'::uuid, 'URGENT', '긴급: 서비스 접속 불가', 'user4@example.com', '010-5678-9012', '현재 서비스 접속이 되지 않습니다. 긴급 확인 부탁드립니다.', 'PENDING', CURRENT_TIMESTAMP - INTERVAL '30 minutes');

-- 쿠폰 추가
INSERT INTO coupons (coupon_code, discount_type, discount_value, valid_from, valid_to, max_usage, used_count) VALUES ('WELCOME2024', 'AMOUNT', 5000, '2024-01-01', '2024-12-31', 1000, 150), ('SPRING30', 'RATE', 30, '2024-03-01', '2024-05-31', 500, 0), ('NEWUSER', 'AMOUNT', 3000, '2024-01-01', '2024-12-31', NULL, 45);

-- culftester와 betatester의 결제 내역 추가
INSERT INTO payments (payment_id, user_id, token_plan_id, payment_number, transaction_number, tokens_purchased, amount, payment_method, payment_date, status) VALUES (uuid_generate_v4(), '1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2', 1, 'PAY_20240110_001', 'TID_20240110_001', 100, 10000, 'kakaopay', '2024-01-10 10:00:00', 'SUCCESS'), (uuid_generate_v4(), '1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2', 2, 'PAY_20240112_001', 'TID_20240112_001', 300, 25000, 'kakaopay', '2024-01-12 15:30:00', 'SUCCESS');

-- 환불 요청을 위한 문의사항 추가
INSERT INTO inquiries (user_id, type, title, email, contact, content, status) VALUES ('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2', 'PAYMENT', '결제 취소 요청', 'betauser1@culf.com', '01043219876', '결제 취소를 요청드립니다.', 'PENDING');

-- 환불 내역 추가
INSERT INTO Refunds (payment_id, user_id, inquiry_id, amount, reason, status, created_at) SELECT p.payment_id, p.user_id, i.inquiry_id, p.amount, '고객 변심', 'PENDING', CURRENT_TIMESTAMP FROM Payments p JOIN Inquiries i ON i.user_id = p.user_id WHERE p.payment_number = 'PAY_20240112_001' LIMIT 1;

-- ================================
-- 문화 허브 관련 테이블들
-- ================================

-- 기관 테이블
CREATE TABLE institutions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    type VARCHAR(100),
    category VARCHAR(100),
    contact VARCHAR(100),
    email VARCHAR(200),
    website VARCHAR(500),
    manager VARCHAR(100),
    address VARCHAR(500),
    latitude FLOAT,
    longitude FLOAT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100)
);

CREATE INDEX idx_institution_type ON institutions(type, category);
CREATE INDEX idx_institution_location ON institutions(latitude, longitude);
CREATE INDEX idx_institutions_is_deleted ON institutions(is_deleted);

-- 전시/공연 테이블 (관리자가 직접 관리)
CREATE TABLE exhibitions (
    id SERIAL PRIMARY KEY,
    institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
    
    -- 기본 정보
    title VARCHAR(500) NOT NULL,
    subtitle VARCHAR(500),
    description TEXT,
    
    -- 기간
    start_date DATE,
    end_date DATE,
    
    -- 장소
    venue VARCHAR(200),
    address VARCHAR(500),
    
    -- 분류
    category VARCHAR(100),
    genre VARCHAR(100),
    
    -- 참여자
    artist VARCHAR(300),
    host VARCHAR(300),
    
    -- 연락처
    contact VARCHAR(200),
    
    -- 요금
    price VARCHAR(200),
    
    -- 웹 정보
    website VARCHAR(500),
    image_url VARCHAR(500),
    
    -- 기타
    keywords VARCHAR(500),
    
    -- 상태
    status VARCHAR(30) DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- 시스템
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100)
);

CREATE INDEX idx_exhibition_period ON exhibitions(start_date, end_date);
CREATE INDEX idx_exhibition_status ON exhibitions(status, is_active);
CREATE INDEX idx_exhibition_title ON exhibitions(title);
CREATE INDEX idx_exhibition_category ON exhibitions(category);
CREATE INDEX idx_exhibitions_is_deleted ON exhibitions(is_deleted);

-- OpenAPI 수집 데이터 테이블
CREATE TABLE culture_hubs (
    id SERIAL PRIMARY KEY,
    
    -- 기본 정보
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- 기간 정보
    start_date DATE,
    end_date DATE,
    period VARCHAR(300),
    
    -- 장소 정보
    venue VARCHAR(300),
    
    -- 분류
    category VARCHAR(100),
    
    -- 참여자
    artist VARCHAR(300),
    
    -- 요금
    price VARCHAR(200),
    
    -- 웹 정보
    website VARCHAR(500),
    image_url VARCHAR(500),
    
    -- API 메타데이터
    api_source VARCHAR(100) NOT NULL,
    culture_code VARCHAR(200),
    
    -- 시스템
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_culture_hub_period ON culture_hubs(start_date, end_date);
CREATE INDEX idx_culture_hub_venue ON culture_hubs(venue);
CREATE INDEX idx_culture_hub_category ON culture_hubs(category);
CREATE INDEX idx_culture_hub_api_source ON culture_hubs(api_source);
CREATE INDEX idx_culture_hub_title ON culture_hubs(title);

-- API 소스 테이블
CREATE TABLE api_sources (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(200) NOT NULL UNIQUE,
    name VARCHAR(300) NOT NULL,
    description TEXT,
    base_url VARCHAR(500),
    location VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    total_collected INTEGER DEFAULT 0,
    last_collection_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_api_sources_key ON api_sources(api_key);
CREATE INDEX idx_api_sources_active ON api_sources(is_active);

-- 파일 관리 테이블
CREATE TABLE smart_files (
    id SERIAL PRIMARY KEY,
    
    -- 파일 정보
    filename VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),
    mime_type VARCHAR(100),
    
    -- 연결 정보
    institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
    exhibition_id INTEGER REFERENCES exhibitions(id) ON DELETE CASCADE,
    
    -- AI 처리 결과
    ai_summary TEXT,
    ai_category VARCHAR(100),
    confidence_score FLOAT,
    
    -- 처리 상태
    processing_status VARCHAR(30) DEFAULT 'pending',
    processing_error TEXT,
    
    -- 추출 정보
    total_pages INTEGER,
    extracted_text TEXT,
    
    -- 시스템
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100)
);

CREATE INDEX idx_smart_file_institution ON smart_files(institution_id);
CREATE INDEX idx_smart_file_exhibition ON smart_files(exhibition_id);
CREATE INDEX idx_smart_file_status ON smart_files(processing_status);
CREATE INDEX idx_smart_files_active ON smart_files(is_active);

-- 기본 기관 데이터 삽입
INSERT INTO institutions (name, type, category, address, is_active, created_by) VALUES
('국립현대미술관', '미술관', '국립', '서울특별시 종로구 삼청로 30', true, 'system'),
('서울시립미술관', '미술관', '시립', '서울특별시 중구 덕수궁길 61', true, 'system'),
('국립중앙박물관', '박물관', '국립', '서울특별시 용산구 서빙고로 137', true, 'system'),
('예술의전당', '복합문화시설', '공공', '서울특별시 서초구 남부순환로 2406', true, 'system');

-- API 소스 기본 데이터 삽입
INSERT INTO api_sources (api_key, name, description, base_url, location, is_active) VALUES
('kcdf', '한국공예디자인문화진흥원 전시도록', '공예 및 디자인 관련 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('kocaca', '한국문화예술회관연합회 공연전시정보', '전국 문화예술회관 공연 및 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('history_museum', '대한민국역사박물관 특별전시', '역사박물관 특별전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('arko', '한국문화예술위원회 아르코미술관전시', '아르코미술관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('jeju_culture', '제주문화예술진흥원 공연전시정보', '제주 지역 문화예술 정보', 'http://www.jeju.go.kr/rest', '제주', true),
('hangeul_museum', '국립한글박물관 전시정보', '한글박물관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('mmca', '국립현대미술관 전시정보', '국립현대미술관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('sema_archive', '서울시립미술관 아카이브', '서울시립미술관 아카이브 정보', 'https://sema.seoul.go.kr', '서울', true),
('sema', '서울시립미술관 전시정보', '서울시립미술관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('barrier_free', '한국문화정보원 전국 문화예술관광지 배리어프리 정보', '배리어프리 문화시설 정보', 'http://api.kcisa.kr/openapi', '전국', true),
('museum_catalog', '국립중앙박물관 외 전시도록', '국립중앙박물관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('integrated_exhibition', '한국문화정보원 외 전시정보(통합)', '통합 전시 정보', 'http://api.kcisa.kr/openapi', '전국', true),
('mapo_art', '마포문화재단 마포아트센터공연전시', '마포아트센터 공연 및 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('arts_center', '예술의전당 전시정보', '예술의전당 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
('daegu_culture', '대구광역시 공연전시정보', '대구 지역 공연 및 전시 정보', 'https://dgfca.or.kr/api', '대구', true),
('jeonju_culture', '전주시 공연전시정보', '전주 지역 공연 및 전시 정보', 'http://api.kcisa.kr/openapi', '전주', true);