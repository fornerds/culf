from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, asc
from . import models, schemas
from datetime import datetime
from typing import List, Optional, Tuple, Union, Dict
from uuid import UUID
from app.domains.curator import services as curator_services
from app.domains.conversation.models import ChatRoom, Conversation
from app.domains.curator.models import Curator

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
        room_id=chat.room_id,
        question=chat.question or "",  # 이미지만 있는 경우 빈 문자열 사용
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

def create_chat_room(db: Session, chat_room: schemas.ChatRoomCreate, user_id: UUID) -> models.ChatRoom:
    """새로운 채팅방을 생성합니다."""
    # 큐레이터 존재 확인
    curator = curator_services.get_curator(db, chat_room.curator_id)
    if not curator:
        raise HTTPException(status_code=404, detail="큐레이터를 찾을 수 없습니다")

    db_chat_room = models.ChatRoom(
        user_id=user_id,
        curator_id=chat_room.curator_id,
        title=chat_room.title or f"{curator.name}와의 대화"  # 제목이 없으면 기본값 설정
    )
    db.add(db_chat_room)
    db.commit()
    db.refresh(db_chat_room)
    return db_chat_room


def get_user_chat_rooms(db: Session, user_id: UUID) -> List[dict]:
    """사용자의 채팅방 목록을 가져옵니다."""
    chat_rooms = (
        db.query(ChatRoom)
        .filter(
            ChatRoom.user_id == user_id,
            ChatRoom.is_active == True
        )
        .options(
            joinedload(ChatRoom.curator).joinedload(Curator.tags)
        )
        .order_by(ChatRoom.created_at.desc())
        .all()
    )

    # 각 채팅방에 대한 추가 정보 계산
    for room in chat_rooms:
        # 현재 사용자의 대화 수 계산
        conversation_count = (
            db.query(Conversation)
            .filter(
                Conversation.room_id == room.room_id,
                Conversation.user_id == user_id
            )
            .count()
        )

        # 현재 사용자의 마지막 대화 가져오기
        last_conversation = (
            db.query(Conversation)
            .filter(
                Conversation.room_id == room.room_id,
                Conversation.user_id == user_id
            )
            .order_by(Conversation.question_time.desc())
            .first()
        )

        # 속성 설정
        setattr(room, '_conversation_count', conversation_count)

        if last_conversation:
            setattr(room, '_last_conversation', {
                "question": last_conversation.question,
                "answer": last_conversation.answer,
                "question_time": last_conversation.question_time
            })
        else:
            setattr(room, '_last_conversation', None)

    return chat_rooms


def get_chat_room(db: Session, room_id: UUID, user_id: UUID) -> Optional[ChatRoom]:
    """특정 채팅방의 정보를 가져옵니다."""
    chat_room = (
        db.query(ChatRoom)
        .filter(
            ChatRoom.room_id == room_id,
            ChatRoom.user_id == user_id,
            ChatRoom.is_active == True
        )
        .options(
            joinedload(ChatRoom.curator),
            joinedload(ChatRoom.conversations)
        )
        .first()
    )

    if not chat_room:
        return None

    # 대화 내역을 시간순으로 정렬
    sorted_conversations = sorted(
        chat_room.conversations,
        key=lambda x: x.question_time.timestamp() if x.question_time else 0,
        reverse=True
    )

    # 기본 정보 설정
    setattr(chat_room, '_conversation_count', len(sorted_conversations))
    if sorted_conversations:
        latest = sorted_conversations[0]
        setattr(chat_room, '_last_conversation', {
            "question": latest.question,
            "answer": latest.answer,
            "question_time": latest.question_time
        })
    else:
        setattr(chat_room, '_last_conversation', None)

    # conversations를 리스트 형태로 변환하여 저장
    sorted_conversations_list = [
        {
            "question": conv.question,
            "answer": conv.answer,
            "question_time": conv.question_time,
            "answer_time": conv.answer_time,
            "question_image": conv.question_image
        }
        for conv in sorted_conversations
    ]
    # _conversations 속성에 저장 (원본 conversations는 그대로 유지)
    setattr(chat_room, '_conversations_list', sorted_conversations_list)

    return chat_room