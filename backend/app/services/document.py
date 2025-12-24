import hashlib
import os
from pathlib import Path
from typing import Optional

import aiofiles
import fitz
from docx import Document as DocxDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings

settings = get_settings()

ALLOWED_EXTENSIONS = {"pdf", "txt", "md", "docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024


def get_file_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def is_allowed_file(filename: str) -> bool:
    return get_file_extension(filename) in ALLOWED_EXTENSIONS


def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


async def save_file(content: bytes, file_path: str) -> None:
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)


async def read_file(file_path: str) -> bytes:
    async with aiofiles.open(file_path, "rb") as f:
        return await f.read()


def extract_text_from_pdf(content: bytes) -> tuple[str, list[dict]]:
    text_parts = []
    pages = []

    doc = fitz.open(stream=content, filetype="pdf")
    for page_num, page in enumerate(doc):
        page_text = page.get_text()
        text_parts.append(page_text)
        pages.append({
            "page_number": page_num + 1,
            "content": page_text,
            "start_char": sum(len(p) for p in text_parts[:-1]),
            "end_char": sum(len(p) for p in text_parts),
        })
    doc.close()

    return "\n".join(text_parts), pages


def extract_text_from_docx(content: bytes) -> str:
    import io
    doc = DocxDocument(io.BytesIO(content))
    return "\n".join(para.text for para in doc.paragraphs)


def extract_text_from_txt(content: bytes) -> str:
    return content.decode("utf-8", errors="ignore")


def extract_text(content: bytes, file_type: str) -> tuple[str, Optional[list[dict]]]:
    if file_type == "pdf":
        return extract_text_from_pdf(content)
    elif file_type == "docx":
        return extract_text_from_docx(content), None
    elif file_type in ("txt", "md"):
        return extract_text_from_txt(content), None
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[dict]:
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=settings.CHUNK_SEPARATORS,
        length_function=len,
    )

    docs = splitter.create_documents([text])
    chunks = []

    current_pos = 0
    for doc in docs:
        chunk_content = doc.page_content.strip()
        if not chunk_content:
            continue

        start_char = text.find(chunk_content, current_pos)
        if start_char == -1:
            start_char = current_pos
        end_char = start_char + len(chunk_content)
        current_pos = max(current_pos, start_char + 1)

        chunks.append({
            "chunk_index": len(chunks),
            "content": chunk_content,
            "content_hash": hashlib.sha256(chunk_content.encode()).hexdigest(),
            "start_char": start_char,
            "end_char": end_char,
        })

    return chunks


def chunk_text_with_pages(
    pages: list[dict],
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[dict]:
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    full_text = "\n\n".join(p["content"] for p in pages)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=settings.CHUNK_SEPARATORS,
        length_function=len,
    )

    docs = splitter.create_documents([full_text])
    chunks = []

    page_offsets = []
    offset = 0
    for page in pages:
        page_offsets.append({
            "page_number": page["page_number"],
            "start": offset,
            "end": offset + len(page["content"]),
        })
        offset += len(page["content"]) + 2

    current_pos = 0
    for doc in docs:
        chunk_content = doc.page_content.strip()
        if not chunk_content:
            continue

        start_char = full_text.find(chunk_content, current_pos)
        if start_char == -1:
            start_char = current_pos
        end_char = start_char + len(chunk_content)
        current_pos = max(current_pos, start_char + 1)

        page_number = None
        for po in page_offsets:
            if po["start"] <= start_char < po["end"]:
                page_number = po["page_number"]
                break

        chunks.append({
            "chunk_index": len(chunks),
            "content": chunk_content,
            "content_hash": hashlib.sha256(chunk_content.encode()).hexdigest(),
            "start_char": start_char,
            "end_char": end_char,
            "page_number": page_number,
        })

    return chunks


class DocumentProcessor:

    def __init__(self, storage_dir: str = "data/documents"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def get_storage_path(self, doc_id: str, file_type: str) -> str:
        return str(self.storage_dir / f"{doc_id}.{file_type}")

    async def process_upload(
        self,
        filename: str,
        content: bytes,
    ) -> dict:
        file_type = get_file_extension(filename)

        if not is_allowed_file(filename):
            raise ValueError(f"File type not allowed: {file_type}")

        if len(content) > MAX_FILE_SIZE:
            raise ValueError(f"File too large. Max size: {MAX_FILE_SIZE} bytes")

        file_hash = compute_file_hash(content)

        return {
            "filename": filename,
            "file_type": file_type,
            "file_size_bytes": len(content),
            "file_hash": file_hash,
            "content": content,
        }

    async def save_document(self, doc_id: str, file_type: str, content: bytes) -> str:
        storage_path = self.get_storage_path(doc_id, file_type)
        await save_file(content, storage_path)
        return storage_path

    def extract_and_chunk(
        self,
        content: bytes,
        file_type: str,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
    ) -> list[dict]:
        text, pages = extract_text(content, file_type)

        if pages:
            chunks = chunk_text_with_pages(pages, chunk_size, chunk_overlap)
        else:
            chunks = chunk_text(text, chunk_size, chunk_overlap)

        return chunks


_document_processor: Optional[DocumentProcessor] = None


def get_document_processor() -> DocumentProcessor:
    global _document_processor
    if _document_processor is None:
        _document_processor = DocumentProcessor()
    return _document_processor
