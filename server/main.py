# -*- coding: utf-8 -*-
"""
============================================================
  复古唱片机 / 磁带音乐网页 · AI 封面生成后端服务
------------------------------------------------------------
  一个极简、无状态的一次性中转服务：
      前端传歌曲信息  →  拼接复古唱片封面提示词
                      →  调用远端文生图接口
                      →  图片二进制转 base64 返回

  特点（面向个人作品集）：
    · 单文件、无数据库、无登录、无限流，拉起来就能跑
    · 密钥全部读 .env，代码里零硬编码
    · 所有异常都捕获并以统一结构返回，进程永不崩
    · 自动生成 FastAPI 交互式文档：/docs

  启动：
      pip install -r requirements.txt
      uvicorn main:app --host 0.0.0.0 --port 8000
============================================================
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

# 读取同目录下的 .env（部署平台注入的环境变量优先）
load_dotenv()

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger("cover")


# ============================================================
#  一、配置：全部来自 .env，代码里不写死任何密钥
# ============================================================
AI_IMAGE_API_KEY = os.getenv("AI_IMAGE_API_KEY", "").strip()
AI_IMAGE_BASE_URL = os.getenv("AI_IMAGE_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
AI_IMAGE_MODEL_NAME = os.getenv("AI_IMAGE_MODEL_NAME", "dall-e-3").strip()

REQUEST_TIMEOUT = 20.0  # 调用文生图服务的超时时间（秒）
FRONTEND_ORIGIN = "http://127.0.0.1:5173"  # 允许跨域的前端地址（Vite 本地调试）

# 统一追加的画面约束：方形唱片封面、中心构图、不要出现文字
PROMPT_SUFFIX = (
    "square vinyl record album cover artwork, centered composition, "
    "vintage 1970s print texture, no text, no watermark, no logo"
)


# ============================================================
#  二、应用实例 + CORS
# ============================================================
app = FastAPI(
    title="Retro Deck · AI Cover Generator",
    description="为复古唱片机网页生成黑胶封面的极简中转服务",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],  # 只允许本地 Vite 前端跨域
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
#  三、数据结构（请求 / 响应契约）
# ============================================================
class CoverRequest(BaseModel):
    """请求体：歌曲信息。

    说明：主字段按 song_name / artist / style / desc 设计；
    同时接受 title / prompt 两个别名，方便前端渐进迁移（不需要可删掉 AliasChoices）。
    """

    model_config = ConfigDict(populate_by_name=True)

    song_name: str = Field(
        ...,
        validation_alias=AliasChoices("song_name", "title"),
        min_length=1,
        max_length=80,
        description="歌曲名",
    )
    artist: str = Field("", max_length=80, description="歌手 / 乐队")
    style: str = Field("", max_length=200, description="视觉风格，如 city pop / lo-fi")
    desc: str = Field(
        "",
        validation_alias=AliasChoices("desc", "prompt"),
        max_length=500,
        description="画面描述",
    )


class CoverResponse(BaseModel):
    """响应体：成功与失败共用一套结构，前端只看 success 即可分流。"""

    success: bool = Field(..., description="是否生成成功")
    image_base64: str = Field("", description="图片 base64 字符串（不带 data:image 前缀）")
    prompt: str = Field("", description="最终发给文生图模型的完整 prompt")
    error_msg: str = Field("", description="失败原因，成功时为空")


def ok(image_base64: str, prompt: str) -> CoverResponse:
    return CoverResponse(success=True, image_base64=image_base64, prompt=prompt)


def fail(error_msg: str) -> CoverResponse:
    """统一失败出口：HTTP 仍然 200，业务失败用 success=False 表达"""
    logger.error("generate failed: %s", error_msg)
    return CoverResponse(success=False, error_msg=error_msg)


# ============================================================
#  四、业务逻辑 1：拼接复古唱片封面提示词
# ============================================================
def build_prompt(req: CoverRequest) -> str:
    """把歌曲信息拼成一句适合文生图模型的英文提示词。

    文生图模型对英文更敏感，因此这里统一输出英文；
    拼接结果会原样回给前端（prompt 字段），方便调试与二次编辑。
    """
    parts = [f'retro vinyl record album cover artwork for the song "{req.song_name.strip()}"']

    if req.artist.strip():
        parts.append(f"by {req.artist.strip()}")
    if req.style.strip():
        parts.append(f"visual style: {req.style.strip()}")
    if req.desc.strip():
        parts.append(req.desc.strip())

    parts.append(PROMPT_SUFFIX)
    return ", ".join(parts)


# ============================================================
#  五、业务逻辑 2：调用远端文生图接口并取回图片二进制
# ============================================================
def build_payload(prompt: str) -> dict[str, Any]:
    """上游请求体（默认 OpenAI 兼容的 /images/generations 写法）。

    换成别的文生图厂商时，通常只需要改这个函数。
    """
    return {
        "model": AI_IMAGE_MODEL_NAME,
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "response_format": "b64_json",  # 直接要 base64，省一次下载
    }


def pick_image_node(data: Any) -> Any:
    """从上游响应里定位到图片节点，兼容几种常见返回格式。"""
    node = data.get("data", data) if isinstance(data, dict) else data
    if isinstance(node, list) and node:
        return node[0]
    return node


async def fetch_image_bytes(client: httpx.AsyncClient, data: Any) -> bytes:
    """把上游响应里的图片取成二进制：优先 b64_json，其次 URL 再下载一次。"""
    node = pick_image_node(data)

    # 形态 A：{"data": [{"b64_json": "..."}]}
    if isinstance(node, dict) and node.get("b64_json"):
        return base64.b64decode(node["b64_json"])

    # 形态 B：{"data": [{"url": "https://..."}]}
    url = node.get("url") if isinstance(node, dict) else (node if isinstance(node, str) else "")
    if isinstance(url, str) and url.startswith(("http://", "https://")):
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content

    raise ValueError(f"响应中未找到图片字段（b64_json / url）：{str(data)[:200]}")


async def call_image_api(prompt: str) -> bytes:
    """调用文生图服务，返回图片二进制。异常向上抛，由路由统一处理。"""
    headers = {
        "Authorization": f"Bearer {AI_IMAGE_API_KEY}",
        "Content-Type": "application/json",
    }
    timeout = httpx.Timeout(REQUEST_TIMEOUT, connect=5.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{AI_IMAGE_BASE_URL}/images/generations",
            json=build_payload(prompt),
            headers=headers,
        )
        resp.raise_for_status()          # 502 / 500 / 401 等 → HTTPStatusError
        data = resp.json()               # 非法 JSON → ValueError
        return await fetch_image_bytes(client, data)


# ============================================================
#  六、唯一接口：POST /generate-cover
# ============================================================
@app.post("/generate-cover", response_model=CoverResponse)
async def generate_cover(req: CoverRequest) -> CoverResponse:
    """传入歌曲信息，返回一张复古唱片封面的 base64 图片。"""
    prompt = build_prompt(req)
    logger.info("prompt -> %s", prompt)

    # 1) 密钥缺失：直接失败，不去打无意义的请求
    if not AI_IMAGE_API_KEY:
        return fail("未配置 AI_IMAGE_API_KEY，请在 .env 中填写文生图服务的密钥")

    # 2) 调用远端文生图服务
    try:
        image_bytes = await call_image_api(prompt)
    except httpx.HTTPStatusError as e:
        # 远端 502 / 500 / 401 ...：错误文案与前端预期严格一致
        status = e.response.status_code
        reason = e.response.reason_phrase or ""
        return fail(f"调用文生图服务失败：{status} {reason}".strip())
    except httpx.TimeoutException:
        return fail(f"调用文生图服务失败：请求超时（{REQUEST_TIMEOUT:g}s）")
    except httpx.RequestError as e:
        # 连接失败 / DNS 失败 / 代理错误等
        return fail(f"调用文生图服务失败：{e}"[:300])
    except ValueError as e:
        # JSON 解析失败，或响应里没有图片字段
        return fail(f"解析文生图服务响应失败：{e}"[:300])
    except Exception as e:  # 兜底：任何意外都不让服务崩掉
        logger.exception("unexpected error")
        return fail(f"生成封面失败：{e}"[:300])

    # 3) 图片二进制 → base64（不带 data:image 前缀）
    if not image_bytes:
        return fail("文生图服务返回了空图片")

    return ok(base64.b64encode(image_bytes).decode("utf-8"), prompt)


@app.post("/api/generate-cover", response_model=CoverResponse, include_in_schema=False)
async def generate_cover_alias(req: CoverRequest) -> CoverResponse:
    """兼容路由：现有前端 AiCoverGen.vue 走的是 /api 前缀，逻辑与 /generate-cover 完全一致。
    前端改成 /generate-cover 之后，可以直接删掉这段（含上面的装饰器）。"""
    return await generate_cover(req)
