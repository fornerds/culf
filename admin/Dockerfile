# Node.js 베이스 이미지 사용
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install --legacy-peer-deps

# 소스 코드 복사
COPY . .

# 빌드
RUN npm run build

# 개발 서버 포트 노출
EXPOSE 3000

# 개발 서버 실행
CMD ["npm", "run", "start"]
