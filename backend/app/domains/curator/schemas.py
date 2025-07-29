from pydantic import BaseModel, Field, validator
from typing import Optional, List

class TagBase(BaseModel):
    name: str = Field(..., max_length=50)

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    tag_id: int

    class Config:
        from_attributes = True

class CuratorBase(BaseModel):
    name: str = Field(..., example="열정맨", description="큐레이터의 이름")
    persona: Optional[str] = Field(None, example="지구 예술에 푹 빠진 외계인", description="큐레이터의 페르소나")
    main_image: Optional[str] = Field(None, example="https://example.com/main.jpg", description="메인 화면용 캐릭터 이미지 URL")
    profile_image: Optional[str] = Field(None, example="https://example.com/profile.jpg", description="큐레이터의 프로필 이미지 URL")
    introduction: Optional[str] = Field(None, example="열정적인 예술 큐레이터입니다.", description="큐레이터 소개")
    category: Optional[str] = Field(None, example="예술", description="큐레이터의 전문 분야")
    background_color: Optional[str] = Field(None, example="#FFFFFF", description="큐레이터 메인 이미지의 배경색")
    text_color: Optional[str] = Field(None, example="#000000", description="큐레이터 메인 이미지의 글자색")
    shadow_color: Optional[str] = Field(None, example="#888888", description="큐레이터 메인 이미지의 그림자색")

class CuratorCreate(CuratorBase):
    tag_names: List[str] = Field([], max_items=2, example=["초보", "미술입문"])

    @validator('tag_names')
    def validate_tags(cls, v):
        if len(v) > 2:
            raise ValueError('Maximum 2 tags are allowed')
        return v

class CuratorUpdate(BaseModel):
    name: Optional[str] = Field(None, example="현대 미술가")
    persona: Optional[str] = Field(None, example="지구 예술에 푹 빠진 외계인")
    main_image: Optional[str] = Field(None, example="https://example.com/new_main.jpg")
    profile_image: Optional[str] = Field(None, example="https://example.com/new_profile.jpg")
    introduction: Optional[str] = Field(None, example="현대 미술을 전공한 큐레이터입니다.")
    category: Optional[str] = Field(None, example="예술")
    tag_names: Optional[List[str]] = Field(None, max_items=2)
    background_color: Optional[str] = Field(None, example="#FFFFFF")
    text_color: Optional[str] = Field(None, example="#000000")
    shadow_color: Optional[str] = Field(None, example="#888888")

    @validator('tag_names')
    def validate_tags(cls, v):
        if v and len(v) > 2:
            raise ValueError('Maximum 2 tags are allowed')
        return v

class Curator(CuratorBase):
    curator_id: int
    tags: List[Tag]

    class Config:
        from_attributes = True