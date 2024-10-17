import base64
from openai import OpenAI
from uuid import UUID
import time
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query
from sqlalchemy.orm import Session
from typing import Optional, Union
from app.db.session import get_db
from app.core.deps import get_current_user
from app.domains.user.models import User
from app.domains.token import services as token_services
from app.core.config import settings
from . import schemas, services
from app.utils.s3_client import upload_file_to_s3
import logging
import uuid
from app.utils.cloudfront_utils import invalidate_cloudfront_cache
from app.utils.s3_client import upload_file_to_s3, get_cloudfront_url

router = APIRouter()

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=settings.OPENAI_API_KEY)

@router.post("/chat", response_model=schemas.ConversationResponse)
async def create_chat(
        question: str = Form(...),
        image_file: Union[UploadFile, None, str] = File(default=None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    채팅 생성 엔드포인트

    이 함수는 사용자의 질문을 받아 OpenAI API를 통해 응답을 생성하고,
    선택적으로 이미지를 처리합니다.
    """
    logging.info(f"사용자 {current_user.user_id}의 채팅 생성 시작")

    # 빈 문자열을 None으로 처리
    if isinstance(image_file, str) and image_file == "":
        image_file = None

    # 개발 모드가 아닌 경우 토큰 검사
    if not settings.DEV_MODE:
        user_tokens = token_services.get_user_tokens(db, current_user.user_id)
        if user_tokens.total_tokens - user_tokens.used_tokens <= 0:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "not_enough_tokens",
                    "message": "토큰이 부족합니다. 토큰을 충전해주세요."
                }
            )

    try:
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

        chat = schemas.ConversationCreate(question=question, question_image=image_url)

        # OpenAI API를 사용한 대화 처리
        thread = client.beta.threads.create()

        # 메시지 내용 준비
        message_content = [{"type": "text", "text": chat.question}]
        if image_url:
            message_content.append({
                "type": "image_url",
                "image_url": {"url": image_url}
            })

        # 스레드에 메시지 생성
        client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=message_content
        )

        # 어시스턴트 실행
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=settings.OPENAI_ASSISTANT_ID
        )

        # 응답 대기 (최대 60초)
        start_time = time.time()
        timeout = 60
        while run.status != "completed":
            if time.time() - start_time > timeout:
                raise TimeoutError("Assistant run timed out")
            time.sleep(1)  # 1초마다 상태 확인
            run = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )

        # 어시스턴트의 응답 가져오기
        messages = client.beta.threads.messages.list(thread_id=thread.id)
        assistant_message = next(msg for msg in messages if msg.role == "assistant")

        answer = assistant_message.content[0].text.value
        tokens_used = 5  # 추후 실제 토큰 사용량을 계산하는 로직 추가 필요

        # 대화 내용 저장 및 토큰 사용
        conversation = services.create_conversation(db, chat, current_user.user_id, answer, tokens_used)
        token_services.use_tokens(db, current_user.user_id, tokens_used)

        # 응답 반환
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

@router.get("/conversations", response_model=schemas.ConversationList)
def get_conversations(
        page: int = Query(1, ge=1),
        limit: int = Query(10, ge=1, le=100),
        sort: str = Query("question_time:desc"),
        summary: bool = Query(False),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    conversations, total_count = services.get_user_conversations(
        db, current_user.user_id, page, limit, sort, summary
    )
    return schemas.ConversationList(conversations=conversations, total_count=total_count)

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