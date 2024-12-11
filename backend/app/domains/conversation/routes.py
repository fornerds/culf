import base64
import json
from datetime import datetime
from openai import OpenAI
from uuid import UUID
import time
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import Optional, Union, Dict, Any
from app.db.session import get_db
from app.core.deps import get_current_user
from app.domains.user.models import User
from app.domains.token import services as token_services
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
from app.domains.user.models import User

router = APIRouter()

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=settings.OPENAI_API_KEY)

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

async def get_recent_chat_history(user_id: str, limit: int = 10) -> list:
    """사용자의 최근 대화 내용을 가져오는 함수"""
    try:
        # 사용자의 가장 최근 대화 찾기
        chat = await mongodb.chats.find_one(
            {"user_id": user_id},
            sort=[("last_updated", -1)]
        )
        
        if chat and "messages" in chat:
            # 최근 10개 메시지만 반환
            return chat["messages"][-limit:]
        return []
    except Exception as e:
        logger.error(f"채팅 기록 조회 중 오류 발생: {str(e)}")
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


@router.post("/chat", response_model=schemas.ConversationResponse)
async def create_chat(
    question: str = Form(...),
    image_file: Union[UploadFile, None, str] = File(
        default=None, 
        description="Image file to upload",
        max_size=10 * 1024 * 1024  # 10MB
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """채팅 생성 엔드포인트"""
    logging.info(f"사용자 {current_user.user_id}의 채팅 생성 시작")

    if isinstance(image_file, str) and image_file == "":
        image_file = None

    # if not settings.DEV_MODE:
    #     user_tokens = token_services.get_user_tokens(db, current_user.user_id)
    #     if user_tokens.total_tokens - user_tokens.used_tokens <= 0:
    #         raise HTTPException(
    #             status_code=402,
    #             detail={
    #                 "error": "not_enough_tokens",
    #                 "message": "토큰이 부족합니다. 토큰을 충전해주세요."
    #             }
    #         )

    try:
        # 이미지 처리 로직
        image_url = None
        if image_file:
            file_extension = image_file.filename.split('.')[-1]
            object_name = f"chat_images/{uuid.uuid4()}.{file_extension}"
            s3_url = upload_file_to_s3(image_file.file, settings.S3_BUCKET_NAME, object_name)
            if not s3_url:
                raise HTTPException(status_code=500, detail="이미지 업로드 실패")

            # CloudFront URL 생성
            image_url = get_cloudfront_url(object_name)
            logging.info(f"업로드된 이미지 CloudFront URL: {image_url}")

            # 캐시 무효화 (선택적)
            invalidation_id = invalidate_cloudfront_cache(object_name)
            if invalidation_id:
                logging.info(f"CloudFront 캐시 무효화 요청 성공. Invalidation ID: {invalidation_id}")
            else:
                logging.warning("CloudFront 캐시 무효화 요청 실패")

        # OpenAI API 호출하여 응답 생성
        functions = [{
            "name": "verify_artwork_info",
            "description": "예술 작품, 작가, 소장처 등의 정보를 검증합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "검증이 필요한 예술 작품이나 작가 관련 질문"
                    }
                },
                "required": ["question"]
            }
        }]

        # 최근 대화 내용 가져오기
        recent_messages = await get_recent_chat_history(str(current_user.user_id), limit=10)

        # 메시지 구성
        messages = [
            {
                "role": "system",
                "content": PROMPT
            }
        ]

        # 이전 대화 내용이 있다면 추가
        if recent_messages:
            context_message = "최근 대화 내용입니다:\n\n"
            for msg in recent_messages:
                context_message += f"{msg['role']}: {msg['content']}\n"
            
            messages.append({
                "role": "system",
                "content": f"{context_message}\n위 대화 내용을 참고하여 답변해주세요."
            })

        # 현재 질문 추가
        messages.append({
            "role": "user",
            "content": []
        })

        messages[-1]["content"].append({
            "type": "text",
            "text": question
        })
        
        # 이미지가 있는 경우 추가
        if image_url:
            messages[-1]["content"].extend([
                {"type": "text", "text": question},
                {"type": "image_url", "image_url": {"url": image_url}}
            ])

        # function_call을 "verify_artwork_info"로 강제 지정
        initial_response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            functions=functions,
            function_call={"name": "verify_artwork_info"}
        )

        # 검증 실행
        verification_result = await verify_artwork_info(question)

        # 검증 결과를 문자열로 변환
        verification_content = json.dumps({
            "result": verification_result if verification_result else "검증 실패",
            "timestamp": str(datetime.now())
        })

        # 검증 결과 추가
        messages.append({
            "role": "function",
            "name": "verify_artwork_info",
            "content": verification_content
        })

        # 최종 응답 생성
        final_response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )

        answer = final_response.choices[0].message.content
        tokens_used = initial_response.usage.total_tokens + final_response.usage.total_tokens

        # SQL DB에 대화 저장
        chat = schemas.ConversationCreate(question=question, question_image=image_url)
        conversation = services.create_conversation(db, chat, current_user.user_id, answer, tokens_used)

        # MongoDB에 채팅 기록 저장
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
            }]
        }

        # MongoDB 업데이트
        await mongodb.chats.update_one(
            {"user_id": str(current_user.user_id)},
            {
                "$push": {"messages": {"$each": chat_data["messages"]}},
                "$setOnInsert": {
                    "created_at": datetime.utcnow()
                },
                "$set": {
                    "last_updated": datetime.utcnow(),
                    "conversation_id": str(conversation.conversation_id)
                }
            },
            upsert=True
        )

        # 토큰 사용량 업데이트
        token_services.use_tokens(db, current_user.user_id, tokens_used)

        return schemas.ConversationResponse(
            conversation_id=conversation.conversation_id,
            answer=conversation.answer,
            tokens_used=conversation.tokens_used
        )

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except TimeoutError as te:
        raise HTTPException(status_code=504, detail=str(te))
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


@router.get("/conversations")
async def get_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    sort: str = Query("question_time:desc"),
    summary: bool = Query(False),
    user_id: Optional[str] = Query(None),
    search_query: str = Query(None, description="사용자 닉네임 검색"),
    db: Session = Depends(get_db)
):
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


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
        conversation_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    success = services.delete_conversation(db, conversation_id, current_user.user_id)
    if not success:
        raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")