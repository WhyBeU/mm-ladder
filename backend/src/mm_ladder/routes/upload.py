from typing import Annotated

from fastapi import APIRouter, File, UploadFile
from fastapi import status as http_status

from mm_ladder.auth import AdminDep
from mm_ladder.deps import PdfImporterDep
from mm_ladder.errors import BadRequestError
from mm_ladder.interface.pdf_import import ImportCommitRequest
from mm_ladder.schemas.pdf_import import ImportCommitResult, ImportPreview

router = APIRouter(prefix="/upload", tags=["upload"])

MAX_PDF_BYTES = 5 * 1024 * 1024  # EventLink standings PDFs are a few hundred KB.


@router.post(
    "/tournament-results-from-pdf/preview",
    response_model=ImportPreview,
    dependencies=[AdminDep],
)
async def preview_pdf(
    importer: PdfImporterDep,
    file: Annotated[UploadFile, File()],
) -> ImportPreview:
    """Dry-run: parse the uploaded PDF and play back the result for review."""
    data = await file.read()
    if not data:
        raise BadRequestError("No file uploaded.")
    if len(data) > MAX_PDF_BYTES:
        raise BadRequestError("File too large — expected an EventLink standings PDF.")
    return await importer.preview(data)


@router.post(
    "/tournament-results-from-pdf",
    response_model=ImportCommitResult,
    status_code=http_status.HTTP_201_CREATED,
    dependencies=[AdminDep],
)
async def commit_pdf(data: ImportCommitRequest, importer: PdfImporterDep) -> ImportCommitResult:
    """Commit the reviewed results to the database (blocks re-import of the same event)."""
    return await importer.commit(data)
