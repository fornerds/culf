from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from . import models, schemas
from datetime import datetime
from typing import List, Optional, Tuple, Union
from uuid import UUID

def create_conversation(
    db: Session,
    chat: schemas.ConversationCreate,
    user_id: UUID,
    answer: str,
    tokens_used: int
) -> models.Conversation:
    # 질문 요약 생성 (첫 줄의 첫 20글자)
    question_lines = chat.question.split('\n')
    first_line = question_lines[0] if question_lines else chat.question
    question_summary = first_line[:20] + "..." if len(first_line) > 20 else first_line

    # 답변 요약 생성 (첫 50글자)
    answer_summary = answer[:50] + "..." if len(answer) > 50 else answer

    # 대화 저장
    db_conversation = models.Conversation(
        user_id=user_id,
        question=chat.question,
        question_summary=question_summary,
        question_image=chat.question_image,
        answer=answer,
        answer_summary=answer_summary,
        question_time=datetime.now(),
        answer_time=datetime.now(),
        tokens_used=tokens_used
    )
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    return db_conversation

def get_user_conversations(
        db: Session,
        user_id: UUID,
        page: int,
        limit: int,
        sort: str,
        summary: bool
) -> Tuple[List[Union[schemas.ConversationSummary, schemas.ConversationDetail]], int]:
    # 사용자의 대화 목록을 조회하는 쿼리 생성
    query = db.query(models.Conversation).filter(models.Conversation.user_id == user_id)

    # 정렬 적용
    sort_field, sort_order = sort.split(':')
    if sort_order == 'desc':
        query = query.order_by(desc(getattr(models.Conversation, sort_field)))
    else:
        query = query.order_by(asc(getattr(models.Conversation, sort_field)))

    # 전체 대화 개수 조회
    total_count = query.count()

    # 페이지네이션 적용
    offset = (page - 1) * limit
    db_conversations = query.offset(offset).limit(limit).all()

    # 요약 여부에 따라 적절한 스키마로 변환
    conversations = []
    for conv in db_conversations:
        if summary:
            # 요약 보기: 질문과 답변을 50자로 제한
            conversations.append(schemas.ConversationSummary(
                conversation_id=conv.conversation_id,
                question_summary=conv.question_summary,
                answer_summary=conv.answer_summary,
                question_time=conv.question_time
            ))
        else:
            # 상세 보기: 모든 필드 포함
            conversations.append(schemas.ConversationDetail(
                conversation_id=conv.conversation_id,
                user_id=conv.user_id,
                question=conv.question,
                question_image=conv.question_image,
                answer=conv.answer,
                question_time=conv.question_time,
                answer_time=conv.answer_time,
                tokens_used=conv.tokens_used
            ))

    return conversations, total_count

def get_conversation(db: Session, conversation_id: UUID, user_id: UUID) -> Optional[models.Conversation]:
    return db.query(models.Conversation).filter(
        models.Conversation.conversation_id == conversation_id,
        models.Conversation.user_id == user_id
    ).first()

def delete_conversation(db: Session, conversation_id: UUID, user_id: UUID) -> bool:
    result = db.query(models.Conversation).filter(
        models.Conversation.conversation_id == conversation_id,
        models.Conversation.user_id == user_id
    ).delete()
    db.commit()
    return result > 0