import base64
import json
from datetime import datetime
from openai import OpenAI
from uuid import UUID
import time
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func
from typing import Optional, Union, Dict, Any, List, Annotated
from app.db.session import get_db
from app.core.deps import get_current_user
from app.domains.user.models import User
from app.domains.token import services as token_services
from app.domains.subscription import services as subscription_services
from app.core.config import settings
from app.domains.conversation.chat_prompt import PROMPT
from . import schemas, services
from app.utils.s3_client import upload_file_to_s3
import logging
import uuid
from app.utils.cloudfront_utils import invalidate_cloudfront_cache
from app.utils.s3_client import upload_file_to_s3, get_cloudfront_url
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from urllib.parse import urlparse
from app.domains.conversation.models import Conversation
from app.domains.conversation.models import ChatRoom
from app.domains.curator.models import Curator, CuratorTagHistory

from app.domains.user.models import User
from app.core.deps import get_current_admin_user
from sqlalchemy import desc

from .schemas import AdminConversationListResponse
from app.domains.conversation.models import CHAT_TOKEN_COST

router = APIRouter()

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=settings.OPENAI_API_KEY)
logging.info(settings.OPENAI_API_KEY)

# 로그 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB 연결 설정
MONGODB_URL = settings.MONGODB_URL
if not MONGODB_URL:
    raise ValueError("MONGODB_URL is not set in the environment variables")

# MongoDB 클라이언트 초기화 및 데이터베이스 연결
mongo_client = AsyncIOMotorClient(MONGODB_URL)
mongodb = mongo_client.culf  # 데이터베이스 이름을 'culf'로 지정


def get_recent_room_conversations(db: Session, room_id: UUID, limit: int = 10) -> list:
    """특정 채팅방의 최근 대화 내용을 가져오는 함수"""
    try:
        # 채팅방의 최근 대화 조회
        recent_conversations = (
            db.query(Conversation)
            .filter(Conversation.room_id == room_id)
            .order_by(Conversation.question_time.desc())
            .limit(limit)
            .all()
        )

        # GPT 메시지 형식으로 변환
        messages = []
        for conv in reversed(recent_conversations):  # 시간순 정렬을 위해 역순으로
            if conv.question:
                messages.append({
                    "role": "user",
                    "content": conv.question
                })
            if conv.answer:
                messages.append({
                    "role": "assistant",
                    "content": conv.answer
                })

        return messages
    except Exception as e:
        logger.error(f"채팅방 대화 기록 조회 중 오류 발생: {str(e)}")
        return []


async def get_perplexity_answer(question: str) -> Optional[dict]:
    """Perplexity API를 사용하여 먼저 정확한 정보를 얻습니다."""
    try:
        logger.info(f"🔄 Perplexity API 요청 시작 - 질문: {question}")

        perplexity_api_key = settings.getenv("PERPLEXITY_API_KEY")
        if not perplexity_api_key:
            logger.error("🚫 PERPLEXITY_API_KEY not found")
            return None

        headers = {
            "Authorization": f"Bearer {perplexity_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "llama-3.1-sonar-huge-128k-online",
            "messages": [
                {
                    "role": "system",
                    "content": "당신은 예술과 역사에 대한 정보를 정확하게 제공하는 전문가입니다. 답변에는 반드시 신뢰할 수 있는 출처를 포함해주세요."
                },
                {
                    "role": "user",
                    "content": question
                }
            ],
            "temperature": 0.2,
            "top_p": 0.9
        }

        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()

        result = response.json()
        logger.info("📥 Perplexity API 응답 수신 성공")

        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content']
            citations = result.get('citations', [])
            logger.info(f"✅ Perplexity 답변: {content[:100]}...")
            logger.info(f"📚 출처: {citations}")

        return result

    except Exception as e:
        logger.error(f"❌ Perplexity API 오류: {str(e)}")
        return None


def verify_artwork_info(question: str) -> Optional[Dict[str, Any]]:
    """예술 작품 정보를 Perplexity API로 검증합니다."""
    try:
        return get_perplexity_answer(question)
    except Exception as e:
        logging.error(f"작품 정보 검증 실패: {e}")
        return None


async def get_gemini_response(question: str, image_url: Optional[str] = None) -> Optional[tuple[str, int]]:
    """Gemini API를 사용하여 GPT와 동일한 형식의 응답을 생성하는 함수"""
    try:
        logger.info("🔄 Gemini API 요청 시작")

        # GPT 스타일의 시스템 프롬프트 추가
        system_prompt = PROMPT  # GPT에서 사용하는 것과 동일한 PROMPT 사용

        # 컨텍스트와 질문을 결합
        formatted_question = f"""
        {system_prompt}

        User: {question}

        Assistant: """

        content = {
            "parts": [{"text": formatted_question}]
        }

        if image_url:
            image_response = requests.get(image_url)
            if image_response.status_code == 200:
                image_data = base64.b64encode(image_response.content).decode('utf-8')
                content["parts"].insert(1, {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": image_data
                    }
                })

        payload = {
            "contents": [content],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 2048,
                "stopSequences": ["User:", "Human:"]  # 응답 종료 지점 설정
            }
        }

        headers = {
            "Content-Type": "application/json"
        }

        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()

        result = response.json()
        if 'candidates' in result and len(result['candidates']) > 0:
            content = result['candidates'][0]['content']
            text = content['parts'][0]['text']

            # Assistant: 이후의 텍스트만 추출
            if "Assistant:" in text:
                text = text.split("Assistant:", 1)[1].strip()

            # 토큰 수 계산 (근사값)
            tokens_used = len(text.split())
            logger.info("✅ Gemini API 응답 성공")
            return text, tokens_used

        return None, 0

    except Exception as e:
        logger.error(f"❌ Gemini API 오류: {str(e)}")
        raise


# settings.py에 추가할 설정
USE_GEMINI = True  # True면 Gemini 사용, False면 GPT 사용
GEMINI_API_KEY = "AIzaSyBTvYm8E3J2XWDceUwU_Ydfx2Z8ZeNpsCo"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent"


async def get_gemini_response(question: str, image_url: Optional[str] = None) -> Optional[tuple[str, int]]:
    """Gemini API를 사용하여 응답을 생성하는 함수"""
    try:
        logger.info("🔄 Gemini API 요청 시작")

        content = {
            "parts": [{"text": question}]
        }

        if image_url:
            image_response = requests.get(image_url)
            if image_response.status_code == 200:
                image_data = base64.b64encode(image_response.content).decode('utf-8')
                content["parts"].append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": image_data
                    }
                })

        payload = {
            "contents": [content],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 2048,
            }
        }

        headers = {
            "Content-Type": "application/json"
        }

        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()

        result = response.json()
        if 'candidates' in result and len(result['candidates']) > 0:
            content = result['candidates'][0]['content']
            text = content['parts'][0]['text']
            # 간단한 토큰 계산 (실제 사용량과 다를 수 있음)
            tokens_used = len(text.split())
            logger.info("✅ Gemini API 응답 성공")
            return text, tokens_used

        return None, 0

    except Exception as e:
        logger.error(f"❌ Gemini API 오류: {str(e)}")
        raise


@router.post(
    "/chat",
    response_model=schemas.ConversationResponse,
    summary="새로운 채팅 생성",
    responses={
        200: {
            "description": "채팅 생성 성공",
            "content": {
                "application/json": {
                    "example": {
                        "conversation_id": "b39190ce-a097-4965-bf20-13100cb0420d",
                        "answer": "안녕하세요! 무엇을 도와드릴까요?",
                        "tokens_used": 150
                    }
                }
            }
        },
        402: {
            "description": "스톤 부족",
            "content": {
                "application/json": {
                    "example": {
                        "error": "not_enough_tokens",
                        "message": "스톤이 부족합니다. 스톤을 충전해주세요."
                    }
                }
            }
        },
        500: {
            "description": "서버 오류",
            "content": {
                "application/json": {
                    "example": {
                        "error": "internal_server_error",
                        "message": "내부 서버 오류가 발생했습니다."
                    }
                }
            }
        }
    }
)
async def create_chat(
        question: Optional[str] = Form(
            None,
            description="질문 내용 (선택)"
        ),
        room_id: Optional[UUID] = Form(
            None,
            description="채팅방 ID (선택, UUID 형식)"
        ),
        image_files: Optional[List[UploadFile]] = File(None, description="이미지 파일들 (선택, 각 최대 10MB)"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    새로운 채팅 대화를 생성합니다.

    Parameters
    ----------
    - question: 질문 내용 (선택)
    - room_id: 채팅방 ID (선택)
    - image_files: 이미지 파일 (선택, 최대 10MB)

    Returns
    -------
    - conversation_id: 생성된 대화의 고유 ID
    - answer: AI의 응답
    - tokens_used: 사용된 토큰 수
    """
    logging.info(f"사용자 {current_user.user_id}의 채팅 생성 시작")

    # 슈퍼유저와 관리자는 토큰 체크 제외
    if current_user.role not in ['SUPERUSER', 'ADMIN']:
        # 구독(무제한) 여부 확인
        is_subscribed = subscription_services.is_user_subscribed(db, current_user.user_id)
        
        # 구독이 아니라면, 일반 토큰 보유 여부 확인
        if not is_subscribed:
            user_tokens = token_services.get_user_tokens(db, current_user.user_id)
            if user_tokens.total_tokens < CHAT_TOKEN_COST:
                raise HTTPException(
                    status_code=402,
                    detail={
                        "error": "not_enough_tokens",
                        "message": "스톤이 부족합니다. 스톤을 충전해주세요."
                    }
                )

    try:
        # room_id가 주어진 경우 채팅방 정보 확인
        chat_room = None
        curator = None
        if room_id:
            chat_room = services.get_chat_room(db, room_id, current_user.user_id)
            if not chat_room:
                raise HTTPException(
                    status_code=404,
                    detail={
                        "error": "chat_room_not_found",
                        "message": "채팅방을 찾을 수 없습니다"
                    }
                )
            curator = chat_room.curator

        # 입력값 유효성 검사
        if (not question or question.strip() == "") and (not image_files or len(image_files) == 0):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_input",
                    "message": "질문 또는 이미지 중 하나는 필수입니다."
                }
            )

        # 이미지 처리 로직
        image_urls = []
        if image_files:
            for image_file in image_files:
                # 파일 타입 검증
                if not image_file.content_type.startswith('image/'):
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "error": "invalid_file_type",
                            "message": "허용되지 않는 파일 형식입니다."
                        }
                    )

                # S3 업로드
                file_extension = image_file.filename.split('.')[-1]
                object_name = f"chat_images/{uuid.uuid4()}.{file_extension}"
                s3_url = upload_file_to_s3(
                    image_file.file,
                    settings.S3_BUCKET_NAME,
                    object_name
                )

                if not s3_url:
                    raise HTTPException(
                        status_code=500,
                        detail="이미지 업로드 실패"
                    )

                # CloudFront URL 추가
                cloudfront_url = get_cloudfront_url(object_name)
                image_urls.append(cloudfront_url)

        answer = None
        tokens_used = 0
        model_used = "gemini" if settings.USE_GEMINI else "gpt"

        if settings.USE_GEMINI:
            # Gemini 사용
            logger.info("Gemini API 사용")

            image_url = image_urls[0]["file_url"] if image_urls else None
            answer, tokens_used = await get_gemini_response(question, image_url)
            if not answer:
                raise HTTPException(status_code=500, detail="Gemini 응답 생성 실패")
        else:
            system_prompt = PROMPT
            if chat_room:
                system_prompt = f"""당신은 {curator.name}입니다. 
                페르소나: {curator.persona}
                소개: {curator.introduction}
                전문 분야: {curator.category}
                대화 상대: {current_user.nickname}

                {PROMPT}

                ### 중요한 응답 규칙 ###
                1. 가독성
                   - 모든 답변은 800~1000자 이내로 작성
                   - 짧은 문장과 단락으로 구성하여 읽기 쉽게 작성
                   - 중요한 내용은 줄바꿈으로 구분하여 강조

                2. 사용자 참여
                   - 적절한 시점에 사용자의 의견을 물어보는 문장 포함 (예: "{current_user.nickname}님도 이런 경험이 있으신가요?")
                   - 매 답변마다 하지 않되, 자연스러운 흐름에서 간간이 포함

                3. 정보의 신뢰성
                   - 모든 예술 작품 설명에는 반드시 출처 명시 (전시 도록, 미술관 공식 자료, 최신 논문 등)
                   - 출처 표시 예시: "전시 도록에 따르면...", "미술관 공식 홈페이지의 설명을 보면..."

                모든 답변은 반드시 다음 형식으로 작성해주세요:

                [답변]
                - 800~1000자 이내로 작성
                - 출처 있는 정보는 반드시 출처 표시
                - 적절한 곳에 사용자 참여 유도 문구 포함

                [대화 요약]
                현재까지의 대화를 20자 이내로 요약하세요. 이 요약은 채팅방의 제목으로 사용됩니다.

                [추천 질문]
                - 추천 질문은 특정 사용자를 지칭하지 않고 일반적인 형태로 작성
                - 각 질문은 현재 대화 주제와 직접적으로 연관된 내용으로 구성
                1. 첫 번째 추천 질문
                2. 두 번째 추천 질문
                3. 세 번째 추천 질문"""

            # GPT 사용
            logger.info("GPT API 사용")
            messages = [
                {"role": "system", "content": system_prompt}
            ]

            # 최근 대화 내역 추가 (채팅방이 있는 경우)
            if room_id:
                recent_messages = get_recent_room_conversations(db, room_id)
                messages.extend(recent_messages)

            current_message = {
                "role": "user",
                "content": []
            }

            # 텍스트 질문 추가
            if question:
                current_message["content"].append({
                    "type": "text",
                    "text": question
                })

            # 이미지 추가
            if image_urls:
                for url in image_urls:
                    current_message["content"].append({
                        "type": "image_url",
                        "image_url": {
                            "url": url
                        }
                    })

            messages.append(current_message)

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=messages
            )

            answer = response.choices[0].message.content
            logging.info(f"Raw GPT response:\n{answer}")

            if not answer:
                raise HTTPException(status_code=500, detail="응답 생성에 실패했습니다")
            tokens_used = response.usage.total_tokens

        try:
            sections = answer.split('[')
            answer_section = ""
            summary = ""
            recommended_questions = []

            if '[답변]' in answer:
                # [답변] 태그가 있는 경우
                answer_section = answer.split('[답변]')[1]  # [답변] 이후 텍스트 추출
            else:
                # [답변] 태그가 없는 경우
                answer_section = answer

            # [대화 요약] 이전 부분만 답변으로 사용
            if '[대화 요약]' in answer_section:
                answer_section = answer_section.split('[대화 요약]')[0]

            # 결과 문자열 정리 (앞뒤 공백 제거)
            answer_section = answer_section.strip()
            logging.info(f"Parsed answer section:\n{answer_section}")

            # 답변이 비어있는지 확인
            if not answer_section:
                # [대화 요약] 이전까지의 모든 텍스트를 답변으로 처리
                answer_section = answer.split('[대화 요약]')[0].strip()
                logging.info(f"Using full text as answer:\n{answer_section}")

            # 대화 요약 섹션 처리
            if '[대화 요약]' in answer:
                summary_part = answer.split('[대화 요약]')[1]
                summary = summary_part.split('[')[0].strip()
                if '[추천 질문]' in summary:
                    summary = summary.split('[추천 질문]')[0].strip()
                logging.info(f"Parsed summary: {summary}")

            # 추천 질문 섹션 처리
            if '[추천 질문]' in answer:
                questions_part = answer.split('[추천 질문]')[1]
                questions = [q.strip() for q in questions_part.split('\n') if q.strip()]
                recommended_questions = [q.split('. ')[1] for q in questions if len(q.split('. ')) > 1]
                logging.info(f"Parsed recommended questions: {recommended_questions}")

            # 추천 질문이 3개 미만인 경우 기본 질문으로 보충
            while len(recommended_questions) < 3:
                if len(recommended_questions) == 0:
                    recommended_questions.append("이 주제에 대해 더 자세히 알고 싶어요.")
                elif len(recommended_questions) == 1:
                    recommended_questions.append("다른 관점에서는 어떻게 볼 수 있을까요?")
                elif len(recommended_questions) == 2:
                    recommended_questions.append("실제 사례나 예시를 들어주실 수 있나요?")

            logging.info(f"Final recommended questions (after filling defaults): {recommended_questions}")

        except Exception as e:
            logging.error(f"Error parsing GPT response: {str(e)}\nRaw response: {answer}")
            # 파싱 실패 시 기본값 설정
            answer_section = answer
            recommended_questions = [
                "이 주제에 대해 더 자세히 알고 싶어요.",
                "다른 관점에서는 어떻게 볼 수 있을까요?",
                "실제 사례나 예시를 들어주실 수 있나요?"
            ]
            logging.info("Using default questions due to parsing error")

        # 대화 저장과 채팅방 제목 업데이트
        chat = schemas.ConversationCreate(
            question=question,
            question_images=image_urls,
            room_id=room_id
        )
        # answer_section을 저장 (전체 응답이 아닌 파싱된 답변만)
        conversation = services.create_conversation(db, chat, current_user.user_id, answer_section, tokens_used)

        # 채팅방 제목 업데이트 (summary 사용)
        if chat_room and summary:
            old_title = chat_room.title
            chat_room.title = summary
            db.commit()
            logging.info(f"Updated chat room title from '{old_title}' to '{chat_room.title}'")

        # MongoDB 저장
        chat_data = {
            "conversation_id": str(conversation.conversation_id),
            "user_id": str(current_user.user_id),
            "messages": [{
                "role": "user",
                "content": question,
                "timestamp": datetime.utcnow()
            }, {
                "role": "assistant",
                "content": answer,
                "timestamp": datetime.utcnow()
            }],
            "model_used": model_used
        }

        await mongodb.chats.update_one(
            {"user_id": str(current_user.user_id)},
            {
                "$push": {"messages": {"$each": chat_data["messages"]}},
                "$setOnInsert": {"created_at": datetime.utcnow()},
                "$set": {
                    "last_updated": datetime.utcnow(),
                    "conversation_id": str(conversation.conversation_id)
                }
            },
            upsert=True
        )

        # 토큰 사용량 업데이트
        if current_user.role not in ['SUPERUSER', 'ADMIN']:
            # 구독이 아닌 경우에만 일반 토큰 차감
            if not is_subscribed:
                token_services.use_tokens(db, current_user.user_id, CHAT_TOKEN_COST)

        return schemas.ConversationResponse(
            conversation_id=conversation.conversation_id,
            answer=answer_section,
            tokens_used=conversation.tokens_used,
            images=image_urls if image_urls else None,
            recommended_questions=recommended_questions
        )

    except HTTPException as e:
        # HTTP 예외는 그대로 전달
        logging.error(f"채팅 생성 중 오류 발생: {str(e)}")
        db.rollback()
        raise e
    except Exception as e:
        logging.error(f"채팅 생성 중 오류 발생: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_server_error",
                "message": "내부 서버 오류가 발생했습니다. 관리자에게 문의해주세요."
            }
        )


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        base64_image = base64.b64encode(contents).decode("utf-8")
        return {"image_data": base64_image}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process the image: {str(e)}")


@router.get(
    "/conversations",
    summary="대화 목록 조회",
    responses={
        200: {
            "description": "대화 목록 조회 성공",
            "content": {
                "application/json": {
                    "example": {
                        "conversations": [
                            {
                                "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
                                "question_summary": "오늘 날씨는 어떤가요?",
                                "answer_summary": "서울의 현재 날씨는 맑습니다.",
                                "question_time": "2024-01-01T12:00:00"
                            }
                        ],
                        "total_count": 1
                    }
                }
            }
        }
    }
)
async def get_conversations(
        page: int = Query(1, ge=1, description="페이지 번호 (1부터 시작)"),
        limit: int = Query(10, ge=1, description="페이지당 항목 수"),
        sort: str = Query(
            "question_time:desc",
            description="정렬 기준 (예: question_time:desc)"
        ),
        summary: bool = Query(
            False,
            description="요약 보기 여부 (true/false)"
        ),
        user_id: Optional[str] = Query(
            None,
            description="특정 사용자의 대화만 조회"
        ),
        search_query: Optional[str] = Query(
            None,
            description="사용자 닉네임으로 검색"
        ),
        db: Session = Depends(get_db)
):
    """대화 목록을 조회합니다."""
    # 정렬 조건 파싱
    sort_field, sort_order = sort.split(":")
    sort_expr = getattr(getattr(Conversation, sort_field), sort_order)()

    # 기본 쿼리 생성
    query = (
        select(
            Conversation,
            User.nickname.label("user_nickname")
        )
        .join(User, Conversation.user_id == User.user_id)
    )

    # 검색어가 있는 경우 필터 적용
    if search_query:
        query = query.filter(User.nickname.ilike(f"%{search_query}%"))

    # 사용자 필터링 적용
    if user_id:
        query = query.where(Conversation.user_id == user_id)

    query = query.order_by(sort_expr)

    # 전체 개수 조회를 위한 쿼리
    count_query = select(func.count()).select_from(Conversation)
    if user_id:
        count_query = count_query.where(Conversation.user_id == user_id)

    total_count = db.scalar(count_query)

    # 페이지네이션 적용
    offset = (page - 1) * limit
    results = db.execute(
        query.offset(offset).limit(limit)
    ).all()

    # 응답 데이터 구성
    conversations = []
    for result in results:
        conversation = result[0].__dict__
        conversation["user_nickname"] = result[1]

        if summary and conversation["answer"]:
            conversation["answer"] = conversation["answer"][:100] + "..."

        conversations.append(conversation)

    return {
        "conversations": conversations,
        "total_count": total_count
    }


@router.get(
    "/conversations/{conversation_id}",
    response_model=schemas.ConversationDetail,
    summary="특정 대화 상세 조회",
    responses={
        200: {
            "description": "대화 조회 성공",
            "content": {
                "application/json": {
                    "example": {
                        "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
                        "user_id": "123e4567-e89b-12d3-a456-426614174000",
                        "question": "예술에 대해 설명해주세요",
                        "question_images": "https://example.com/image.jpg",
                        "answer": "예술은 인간의 미적감각과 ...",
                        "question_time": "2024-01-01T12:00:00",
                        "answer_time": "2024-01-01T12:00:05",
                        "tokens_used": 150
                    }
                }
            }
        },
        404: {
            "description": "대화를 찾을 수 없음",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "대화를 찾을 수 없습니다"
                    }
                }
            }
        }
    }
)
@router.get("/conversations/{conversation_id}", response_model=schemas.ConversationDetail)
def get_conversation(
        conversation_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    conversation = services.get_conversation(db, conversation_id, current_user.user_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")
    return conversation


@router.delete(
    "/conversations/{conversation_id}",
    status_code=204,
    summary="대화 삭제",
    responses={
        204: {
            "description": "대화 삭제 성공"
        },
        404: {
            "description": "대화를 찾을 수 없음",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "대화를 찾을 수 없습니다"
                    }
                }
            }
        }
    }
)
def delete_conversation(
        conversation_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    success = services.delete_conversation(db, conversation_id, current_user.user_id)
    if not success:
        raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")


@router.post(
    "/chat-rooms",
    response_model=schemas.ChatRoomResponse,
    summary="새 채팅방 생성",
    responses={
        200: {
            "description": "채팅방 생성 성공",
            "content": {
                "application/json": {
                    "example": {
                        "room_id": "123e4567-e89b-12d3-a456-426614174000",
                        "title": "두리와의 대화",
                        "curator_id": "1"
                    }
                }
            }
        }
    }
)
@router.post("/chat-rooms", response_model=schemas.ChatRoomResponse)
async def create_chat_room(
        chat_room: Annotated[
            schemas.ChatRoomCreate,
            Body(
                example={
                    "curator_id": 1,
                    "title": "두리와의 대화"
                }
            )
        ],
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """새로운 채팅방을 생성합니다."""
    return services.create_chat_room(db, chat_room, current_user.user_id)


@router.get(
    "/chat-rooms",
    response_model=List[schemas.ChatRoomListItem],
    summary="채팅방 목록 조회",
    responses={
        200: {
            "description": "채팅방 목록 조회 성공",
            "content": {
                "application/json": {
                    "example": [{
                        "room_id": "123e4567-e89b-12d3-a456-426614174000",
                        "title": "일반 상담",
                        "curator_id": "1",
                        "conversation_count": 15,
                        "last_conversation": {
                            "question": "마지막 질문입니다",
                            "answer": "마지막 답변입니다",
                            "question_time": "2024-01-01T12:00:00"
                        },
                        "created_at": "2024-01-01T10:00:00",
                        "updated_at": "2024-01-01T12:00:00"
                    }]
                }
            }
        }
    }
)
async def get_chat_rooms(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    현재 사용자의 모든 채팅방 목록을 조회합니다.

    Returns
    -------
    채팅방 목록 (각 채팅방의 정보, 대화 수, 마지막 대화 내용 포함)
    """
    return services.get_user_chat_rooms(db, current_user.user_id)


@router.get(
    "/chat-rooms/{room_id}",
    response_model=schemas.ChatRoomDetail,
    summary="채팅방 상세 정보",
    responses={
        200: {
            "description": "채팅방 조회 성공",
            "content": {
                "application/json": {
                    "example": {
                        "room_id": "123e4567-e89b-12d3-a456-426614174000",
                        "title": "일반 상담",
                        "curator_id": "1",
                        "conversations": [
                            {
                                "question": "첫 번째 질문입니다",
                                "answer": "첫 번째 답변입니다",
                                "question_time": "2024-01-01T12:00:00"
                            },
                            {
                                "question": "두 번째 질문입니다",
                                "answer": "두 번째 답변입니다",
                                "question_time": "2024-01-01T12:05:00"
                            }
                        ],
                        "created_at": "2024-01-01T10:00:00",
                        "updated_at": "2024-01-01T12:05:00"
                    }
                }
            }
        },
        404: {
            "description": "채팅방을 찾을 수 없음"
        }
    }
)
@router.get("/chat-rooms/{room_id}", response_model=schemas.ChatRoomDetail)
async def get_chat_room(
        room_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    특정 채팅방의 모든 정보를 조회합니다.
    대화 내역을 포함한 전체 상세 정보를 반환합니다.
    """
    chat_room = services.get_chat_room(db, room_id, current_user.user_id)
    if not chat_room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    return chat_room


@router.get(
    "/chat-rooms/{room_id}/curator",
    response_model=schemas.ChatRoomCuratorResponse,
    summary="채팅방의 큐레이터 정보 조회",
    responses={
        200: {
            "description": "큐레이터 정보 조회 성공",
            "content": {
                "application/json": {
                    "example": {
                        "room_id": "123e4567-e89b-12d3-a456-426614174000",
                        "curator": {
                            "curator_id": "1",
                            "name": "예술 큐레이터",
                            "persona": "현대 미술을 전공한 큐레이터",
                            "introduction": "안녕하세요, 저는 현대 미술을 전문으로 하는 큐레이터입니다.",
                            "category": "현대 미술",
                            "profile_image": "https://example.com/curator.jpg"
                        }
                    }
                }
            }
        },
        404: {
            "description": "채팅방을 찾을 수 없음",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "채팅방을 찾을 수 없습니다"
                    }
                }
            }
        }
    }
)
async def get_chat_room_curator(
        room_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    특정 채팅방의 큐레이터 정보를 조회합니다.

    Parameters
    ----------
    room_id : UUID
        조회할 채팅방의 ID
    db : Session
        데이터베이스 세션
    current_user : User
        현재 인증된 사용자

    Returns
    -------
    ChatRoomCuratorResponse
        채팅방의 큐레이터 정보
    """
    # 채팅방 조회
    chat_room = (
        db.query(ChatRoom)
        .filter(
            ChatRoom.room_id == room_id,
            ChatRoom.user_id == current_user.user_id,
            ChatRoom.is_active == True
        )
        .options(joinedload(ChatRoom.curator))
        .first()
    )

    if not chat_room:
        raise HTTPException(
            status_code=404,
            detail="채팅방을 찾을 수 없습니다"
        )

    return {
        "room_id": chat_room.room_id,
        "curator": chat_room.curator
    }


@router.get("/admin/chat-rooms")
async def get_chat_rooms(
        page: int = Query(1, ge=1),
        limit: int = Query(10, ge=1, le=1000000),
        search_query: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    try:
        # 대화가 있는 채팅방만 조회하도록 서브쿼리 사용
        rooms_with_conversations = (
            db.query(ChatRoom.room_id)
            .join(Conversation)
            .group_by(ChatRoom.room_id)
            .having(func.count(Conversation.conversation_id) > 0)
            .subquery()
        )

        # Base query with eager loading
        base_query = (
            db.query(ChatRoom)
            .join(rooms_with_conversations, ChatRoom.room_id == rooms_with_conversations.c.room_id)
            .options(
                joinedload(ChatRoom.user),
                joinedload(ChatRoom.curator),
                joinedload(ChatRoom.conversations)
            )
        )

        if search_query:
            base_query = (
                base_query
                .join(ChatRoom.user)
                .join(ChatRoom.curator)
                .filter(
                    (User.nickname.ilike(f"%{search_query}%")) |
                    (Curator.name.ilike(f"%{search_query}%"))
                )
            )

        # Get total count
        total_count = base_query.count()

        # Get paginated results
        chat_rooms = (
            base_query
            .order_by(desc(ChatRoom.created_at))
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        # Format response
        result = []
        for room in chat_rooms:
            historic_tags = (
                db.query(CuratorTagHistory)
                .filter(
                    CuratorTagHistory.curator_id == room.curator_id,
                    func.timezone('Asia/Seoul', CuratorTagHistory.created_at) <= room.created_at
                )
                .order_by(desc(CuratorTagHistory.created_at))
                .first()
            )

            last_conversation = room.conversations[-1] if room.conversations else None

            result.append({
                "room_id": room.room_id,
                "user_name": room.user.nickname if room.user else None,
                "curator_name": room.curator.name if room.curator else None,
                "curator_tags": historic_tags.tag_names if historic_tags and isinstance(historic_tags.tag_names,
                                                                                        list) else
                json.loads(historic_tags.tag_names) if historic_tags else [],
                "title": room.title,
                "last_message": last_conversation.question if last_conversation else None,
                "last_message_time": (
                    last_conversation.answer_time or last_conversation.question_time
                    if last_conversation else None
                ),
                "created_at": room.created_at,
                "message_count": len(room.conversations),
                "is_active": room.is_active,
                "total_tokens_used": room.total_tokens_used,
                "average_tokens_per_conversation": float(
                    room.average_tokens_per_conversation) if room.average_tokens_per_conversation else 0.0
            })

        return {
            "chat_rooms": result,
            "total_count": total_count,
            "page": page,
            "limit": limit
        }

    except Exception as e:
        logging.error(f"Error fetching chat rooms: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="채팅방 목록 조회 중 오류가 발생했습니다.")


@router.get("/admin/chat-rooms/{room_id}")
async def get_chat_room_detail(
        room_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """
    특정 채팅방의 상세 정보와 대화 내역 조회
    """
    try:
        # Get chat room with eager loading
        room = (
            db.query(ChatRoom)
            .options(
                joinedload(ChatRoom.user),
                joinedload(ChatRoom.curator).joinedload(Curator.tags),
                joinedload(ChatRoom.conversations)
            )
            .filter(ChatRoom.room_id == room_id)
            .first()
        )

        if not room:
            raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")

        # Format messages
        messages = []
        last_message_time = None
        for conv in sorted(room.conversations, key=lambda x: x.question_time):
            if conv.question:
                messages.append({
                    "content": conv.question,
                    "created_at": conv.question_time,
                    "is_curator": False
                })
                last_message_time = conv.question_time

            if conv.answer:
                messages.append({
                    "content": conv.answer,
                    "created_at": conv.answer_time,
                    "is_curator": True
                })
                if conv.answer_time and (not last_message_time or conv.answer_time > last_message_time):
                    last_message_time = conv.answer_time

        return {
            "room_id": room.room_id,
            "user_name": room.user.nickname if room.user else None,
            "curator_name": room.curator.name if room.curator else None,
            "created_at": room.created_at,
            "last_message_time": last_message_time,
            "is_active": room.is_active,
            "messages": messages
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching chat room detail: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="채팅방 상세 정보 조회 중 오류가 발생했습니다.")


@router.get(
    "/admin/conversations",
    response_model=AdminConversationListResponse,
    summary="관리자용 대화 목록 조회",
    responses={
        200: {"description": "대화 목록 조회 성공"},
        422: {"description": "입력값 검증 실패"}
    }
)
async def get_admin_conversations(
        page: int = Query(1, ge=1),
        limit: int = Query(10, ge=1, le=1000000),
        search_query: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """관리자용 대화 목록을 조회합니다."""
    try:
        query = (
            db.query(Conversation)
            .options(
                joinedload(Conversation.user),
                joinedload(Conversation.chat_room)
                .joinedload(ChatRoom.curator)
            )
            .order_by(desc(Conversation.question_time))
        )

        # 검색어가 있는 경우 필터 적용
        if search_query:
            query = query.join(User).filter(User.nickname.ilike(f"%{search_query}%"))

        # 전체 개수 조회
        total_count = query.count()

        # 페이지네이션 적용
        conversations = query.offset((page - 1) * limit).limit(limit).all()

        # 응답 데이터 구성
        result = []
        for conv in conversations:
            chat_room = conv.chat_room
            curator = chat_room.curator if chat_room else None

            # 대화 시점의 큐레이터 태그 조회
            historic_tags = None
            if curator:
                historic_tags = (
                    db.query(CuratorTagHistory)
                    .filter(
                        CuratorTagHistory.curator_id == curator.curator_id,
                        CuratorTagHistory.created_at <= conv.question_time
                    )
                    .order_by(desc(CuratorTagHistory.created_at))
                    .first()
                )

            result.append({
                "conversation_id": conv.conversation_id,
                "user_nickname": conv.user.nickname if conv.user else None,
                "question": conv.question,
                "answer": conv.answer,
                "question_time": conv.question_time,
                "answer_time": conv.answer_time,
                "tokens_used": conv.tokens_used,
                "curator": {
                    "name": curator.name if curator else None,
                    "category": curator.category if curator else None
                } if curator else None,
                "curator_tags": (
                    json.loads(historic_tags.tag_names)
                    if historic_tags and isinstance(historic_tags.tag_names, str)
                    else historic_tags.tag_names if historic_tags
                    else []
                )
            })

        return {
            "conversations": result,
            "total_count": total_count
        }

    except Exception as e:
        logging.error(f"Error in get_admin_conversations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="대화 목록 조회 중 오류가 발생했습니다."
        )


@router.delete("/chat-rooms/{room_id}")
async def delete_chat_room(
        room_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """사용자가 자신의 채팅방을 비활성화(삭제) 처리합니다."""
    chat_room = db.query(ChatRoom).filter(
        ChatRoom.room_id == room_id,
        ChatRoom.user_id == current_user.user_id
    ).first()

    if not chat_room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")

    chat_room.is_active = False  # is_deleted 대신 is_active 사용
    db.commit()

    return {"message": "채팅방이 삭제되었습니다"}