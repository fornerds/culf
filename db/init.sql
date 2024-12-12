-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom ENUM types
CREATE TYPE gender_enum AS ENUM ('M', 'F', 'N');
CREATE TYPE status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'BANNED', 'WITHDRAWN');
CREATE TYPE role_enum AS ENUM ('USER', 'ADMIN');
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tags 테이블
CREATE TABLE Tags (
    tag_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
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
    question TEXT NOT NULL,
    question_summary TEXT,
    question_image VARCHAR(255),
    answer TEXT NOT NULL,
    answer_summary TEXT,
    question_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answer_time TIMESTAMP,
    tokens_used INTEGER NOT NULL DEFAULT 0
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
    token_id SERIAL PRIMARY KEY,  -- autoincrement를 위한 SERIAL 추가
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id), -- UUID는 unique constraint 적용
    total_tokens INTEGER NOT NULL DEFAULT 0,
    used_tokens INTEGER NOT NULL DEFAULT 0,
    last_charged_at TIMESTAMPTZ,  -- 시간대를 포함한 TIMESTAMP
    expires_at DATE
);

-- Token Usage History 테이블
CREATE TABLE Token_Usage_History (
    history_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    conversation_id UUID REFERENCES Conversations(conversation_id),
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
    next_billing_date DATE NOT NULL,
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    subscription_number VARCHAR(20) UNIQUE NULL,
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
    payment_number VARCHAR(20) UNIQUE NOT NULL,
    transaction_number VARCHAR(20) UNIQUE NULL,
    tokens_purchased INTEGER,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL,
    used_coupon_id INTEGER REFERENCES Coupons(coupon_id),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status payment_status NOT NULL DEFAULT 'FAILED',
    manual_payment_reason TEXT
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
    inquiry_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES Users(user_id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    attachments VARCHAR(255),
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
    click_count INTEGER NOT NULL DEFAULT 0,
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
    feedback_id SERIAL PRIMARY KEY,
    conversation_id UUID REFERENCES Conversations(conversation_id),
    user_id UUID REFERENCES Users(user_id),
    rating feedback_rating,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- user_id 컬럼 타입 변경
ALTER TABLE users ALTER COLUMN "user_id" SET DATA TYPE uuid;

-- Users 테이블 mock 데이터
INSERT INTO Users (user_id, email, password, nickname, phone_number, birthdate, gender, status, role) VALUES
(uuid_generate_v4(), 'user1@example.com', 'hashedpassword1', '사용자1', '01012345678', '1990-01-01', 'M', 'ACTIVE', 'USER'),
(uuid_generate_v4(), 'user2@example.com', 'hashedpassword2', '사용자2', '01023456789', '1992-02-02', 'F', 'ACTIVE', 'USER'),
(uuid_generate_v4(), 'admin@example.com', 'hashedpassword3', '관리자', '01034567890', '1988-03-03', 'N', 'ACTIVE', 'ADMIN');

INSERT INTO public.users
(user_id, email, "password", nickname, phone_number, birthdate, gender, created_at, updated_at, deleted_at, last_login_at, status, "role", delete_reason, is_corporate, marketing_agreed)
VALUES('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2'::uuid, 'culftester@culf.com', '$2b$12$wkT5HXS4TIhQAgruaHz/cuoqY/RPYnkQL/ewDHhwKK1dUfoRqc8l6', 'culftestnick', '01045678901', '1990-01-01', 'M'::public."gender_enum", '2024-11-04 11:01:18.603', '2024-11-04 11:01:18.603', NULL, NULL, 'ACTIVE'::public."status_enum", 'USER'::public."role_enum", NULL, false, true);

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
('외계인 네오', '지구 예술에 푹 빠진 외계인 네오', 'alien_curator_main.jpg', 'alien_curator.jpg', '처음 만나는 미술! 여러분과 함께 미술 세계를 탐험하고 싶어요.', '미술'),
('레미', '19세기 출신 파리지앵 레미', 'remy_curator_main.jpg', 'remy_curator.jpg', '인상주의 작품들과 유럽 미술을 소개해드립니다.', '미술'),
('두리', '감성 충만한 미술 애호가 두리', 'duri_curator_main.jpg', 'duri_curator.jpg', '한국의 현대미술과 동시대 작가들을 만나보세요.', '미술');

-- 큐레이터-태그 연결
-- 외계인 네오의 태그
INSERT INTO Curator_Tags (curator_id, tag_id)
SELECT c.curator_id, t.tag_id
FROM Curators c, Tags t
WHERE c.name = '외계인 네오' AND t.name IN ('초보', '미술입문');

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
INSERT INTO Subscription_Plans (plan_id, plan_name, price, discounted_price, tokens_included, description, is_promotion) VALUES
(1, '정기 구독', 20000, 15000, 0, '정기구독 플랜입니다.', true);

-- Tokens 테이블 mock 데이터
INSERT INTO Tokens (user_id, total_tokens, used_tokens, last_charged_at, expires_at) VALUES
((SELECT user_id FROM Users WHERE email='user1@example.com'), 100, 30, '2023-09-01', '2023-10-01'),
((SELECT user_id FROM Users WHERE email='user2@example.com'), 250, 80, '2023-08-15', '2023-09-15');

-- Notices 테이블 mock 데이터
INSERT INTO Notices (title, content, image_url, start_date, end_date, view_count, is_public) VALUES
('서비스 업데이트 안내', '9월 20일부터 새로운 AI 모델이 적용됩니다. 더욱 정확하고 다양한 답변을 경험해보세요!', 'update_notice.jpg', '2023-09-15', '2023-09-30', 150, true),
('추석 연휴 고객센터 운영 안내', '추석 연휴 기간 동안 고객센터 운영 시간이 단축됩니다. 자세한 내용은 공지사항을 확인해주세요.', 'holiday_notice.jpg', '2023-09-25', '2023-10-05', 80, true);

-- Notifications 테이블 더미 데이터
INSERT INTO Notifications (user_id, type, message, is_read, created_at) VALUES
((SELECT user_id FROM Users WHERE email='dev@example.com'), 'NEW_CONVERSATION', '문화에 대한 새로운 대화가 시작되었습니다. 지금 참여해보세요!', false, NOW() - INTERVAL '2 days'),
((SELECT user_id FROM Users WHERE email='dev@example.com'), 'TOKEN_UPDATE', '50개의 토큰이 충전되었습니다. 현재 잔액을 확인해보세요.', true, NOW() - INTERVAL '5 days'),
((SELECT user_id FROM Users WHERE email='user2@example.com'), 'CONTENT_UPDATE', '새로운 큐레이션 콘텐츠가 업데이트되었습니다. 지금 확인해보세요!', false, NOW() - INTERVAL '1 day'),
((SELECT user_id FROM Users WHERE email='user2@example.com'), 'PAYMENT_RECEIVED', '15,000원 결제가 완료되었습니다. 영수증을 확인해주세요.', true, NOW() - INTERVAL '3 days'),
((SELECT user_id FROM Users WHERE email='user1@example.com'), 'SYSTEM_NOTICE', '서비스 점검 안내: 내일 오전 2시부터 4시까지 서비스 점검이 있을 예정입니다.', false, NOW() - INTERVAL '12 hours'),
((SELECT user_id FROM Users WHERE email='user2@example.com'), 'NEW_CONVERSATION', '예술에 대한 새로운 대화가 시작되었습니다. 지금 참여해보세요!', false, NOW() - INTERVAL '6 hours'),
((SELECT user_id FROM Users WHERE email='user1@example.com'), 'TOKEN_UPDATE', '100개의 토큰이 사용되었습니다. 남은 토큰을 확인해보세요.', false, NOW() - INTERVAL '1 day'),
((SELECT user_id FROM Users WHERE email='admin@example.com'), 'CONTENT_UPDATE', '새로운 아티클 콘텐츠가 업데이트되었습니다. 지금 확인해보세요!', true, NOW() - INTERVAL '4 days'),
((SELECT user_id FROM Users WHERE email='user1@example.com'), 'PAYMENT_RECEIVED', '30,000원 결제가 완료되었습니다. 영수증을 확인해주세요.', true, NOW() - INTERVAL '2 days'),
((SELECT user_id FROM Users WHERE email='admin@example.com'), 'SYSTEM_NOTICE', '새로운 기능 업데이트: 이제 음성으로도 대화를 나눌 수 있습니다!', false, NOW() - INTERVAL '8 hours');

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