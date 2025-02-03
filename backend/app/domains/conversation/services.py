import json

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
from sqlalchemy import func

def extract_summary_from_answer(answer: str) -> str:
    # 문장 단위로 분리
    sentences = answer.split('.')
    # 첫 문장 추출 (마침표 포함)
    first_sentence = sentences[0].strip() + ('.' if sentences[0].strip() else '')
    # 30자로 제한, 필요시 말줄임표 추가
    return first_sentence[:30] + ('...' if len(first_sentence) > 30 else '')

def update_chat_room_title(db: Session, room_id: UUID, summary: str) -> None:
    db_chat_room = (
        db.query(models.ChatRoom)
        .filter(models.ChatRoom.room_id == room_id)
        .first()
    )
    if db_chat_room:
        db_chat_room.title = summary
        db.commit()

def create_conversation(
    db: Session,
    chat: schemas.ConversationCreate,
    user_id: UUID,
    answer: str,
    tokens_used: int
) -> models.Conversation:
    # 질문 요약 생성 (첫 줄의 첫 20글자)
    question_summary = ""
    if chat.question:
        question_lines = chat.question.split('\n')
        first_line = question_lines[0] if question_lines else chat.question
        question_summary = first_line[:20] + "..." if len(first_line) > 20 else first_line

    # 답변 요약 생성 (첫 50글자)
    answer_summary = extract_summary_from_answer(answer)

    # 사용자 권한 확인
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    is_privileged_user = user.role in ['SUPERUSER', 'ADMIN']

    # 채팅방 스톤 통계 업데이트
    if chat.room_id and not is_privileged_user:
        chat_room = db.query(models.ChatRoom).filter(models.ChatRoom.room_id == chat.room_id).first()
        if chat_room:
            chat_room.update_token_stats(tokens_used)
            update_chat_room_title(db, chat.room_id, answer_summary)

    # 대화 저장
    db_conversation = models.Conversation(
        user_id=user_id,
        room_id=chat.room_id,
        question=chat.question or "",  # 이미지만 있는 경우 빈 문자열 사용
        question_summary=question_summary,
        question_images=chat.question_images,
        answer=answer,
        answer_summary=answer_summary,
        question_time=datetime.now(),
        answer_time=datetime.now(),
        tokens_used=tokens_used
    )
    try:
        db.add(db_conversation)
        db.commit()
        db.refresh(db_conversation)
        return db_conversation
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "error": "database_error",
                "message": f"대화 저장 중 오류가 발생했습니다: {str(e)}"
            }
        )

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
                question_images=conv.question_images,
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
   # 대화가 있는 채팅방만 조회하도록 서브쿼리 사용
   rooms_with_conversations = (
       db.query(ChatRoom.room_id)
       .join(Conversation)
       .filter(Conversation.user_id == user_id)
       .group_by(ChatRoom.room_id)
       .having(func.count(Conversation.conversation_id) > 0)
       .subquery()
   )

   chat_rooms = (
       db.query(ChatRoom)
       .join(rooms_with_conversations, ChatRoom.room_id == rooms_with_conversations.c.room_id)
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

    # conversations를 리스트로 변환
    conversations_list = []
    for conv in chat_room.conversations:
        conv_dict = {
            "question": conv.question,
            "answer": conv.answer,
            "question_time": conv.question_time,
            "answer_time": conv.answer_time,
            "question_images": None  # 기본값으로 None 설정
        }

        # 이미지 정보가 있는 경우 처리
        if conv.question_images:
            if isinstance(conv.question_images, list):
                conv_dict["question_images"] = conv.question_images
            elif isinstance(conv.question_images, str):
                try:
                    # 문자열로 저장된 배열을 파싱
                    import json
                    conv_dict["question_images"] = json.loads(conv.question_images)
                except json.JSONDecodeError:
                    conv_dict["question_images"] = None

        conversations_list.append(conv_dict)

    # 속성 설정
    setattr(chat_room, '_conversation_count', len(conversations_list))
    setattr(chat_room, '_conversations_list', conversations_list)
    
    # 마지막 대화 설정
    if conversations_list:
        latest = conversations_list[-1]
        setattr(chat_room, '_last_conversation', {
            "question": latest["question"],
            "answer": latest["answer"],
            "question_time": latest["question_time"]
        })
    else:
        setattr(chat_room, '_last_conversation', None)

    return chat_room