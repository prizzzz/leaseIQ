import subprocess
import os
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
POPPLER_PATH = r"C:\poppler\poppler-25.12.0\Library\bin"
TESSERACT_EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

if POPPLER_PATH not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + POPPLER_PATH

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Optimized OCR Pipeline: PDF -> 300 DPI PNG -> Tesseract (Cleaned)
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Source PDF not found: {pdf_path}")

    all_text = []

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        
        # 1. Convert PDF to High-Res Image
        try:
            pdftoppm_cmd = [
                "pdftoppm", "-png", "-r", "300", 
                str(pdf_path), str(tmp_path / "page")
            ]
            subprocess.run(pdftoppm_cmd, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            logger.error(f"Poppler conversion failed: {e.stderr.decode()}")
            raise RuntimeError("Failed to convert PDF to images.")

        # 2. Process each page with Tesseract
        images = sorted(tmp_path.glob("*.png"))
        for i, img_path in enumerate(images):
            try:
                # REMOVED WHITELIST: Critical for reading legal text and currency symbols
                # CHANGED PSM to 6: Better for uniform blocks/tables in contracts
                tess_cmd = [
                    TESSERACT_EXE,
                    str(img_path),
                    "stdout",
                    "--psm", "6", 
                    "--oem", "3",
                    "-c", "preserve_interword_spaces=1"
                ]
                
                result = subprocess.run(tess_cmd, capture_output=True, check=True, text=True, encoding="utf-8")
                page_content = result.stdout
                
                if page_content.strip():
                    all_text.append(f"--- PAGE {i+1} ---\n{page_content}")
            
            except subprocess.CalledProcessError as e:
                logger.error(f"Tesseract failed on page {i+1}")
                continue

    combined_text = "\n\n".join(all_text)
    
    # 3. Post-Processing (Integrate your clean_text/handle_layout here)
    try:
        from app.services.text_processing import clean_text, handle_layout
        combined_text = handle_layout(clean_text(combined_text))
    except (ImportError, Exception):
        logger.warning("Cleaning service skipped.")

    return combined_text


# import subprocess
# import os
# import logging
# import tempfile
# from pathlib import Path

# # Setup logging to debug extraction quality
# logger = logging.getLogger(__name__)

# # --- CONFIGURATION ---
# # Use raw strings for Windows paths to avoid escape character issues
# POPPLER_PATH = r"C:\poppler\poppler-25.12.0\Library\bin"
# TESSERACT_EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# # Add Poppler to the environment PATH so subprocess can find pdftoppm directly
# if POPPLER_PATH not in os.environ["PATH"]:
#     os.environ["PATH"] += os.pathsep + POPPLER_PATH

# def check_dependencies():
#     """Verify that external tools are accessible."""
#     if not os.path.exists(TESSERACT_EXE):
#         logger.error(f"Tesseract missing at: {TESSERACT_EXE}")
#         raise RuntimeError(f"Tesseract OCR not found at {TESSERACT_EXE}")
    
#     pdftoppm = os.path.join(POPPLER_PATH, "pdftoppm.exe")
#     if not os.path.exists(pdftoppm):
#         logger.error(f"Poppler missing at: {pdftoppm}")
#         raise RuntimeError(f"Poppler (pdftoppm) not found at {pdftoppm}")

# def extract_text_from_pdf(pdf_path: str) -> str:
#     """
#     Optimized OCR Pipeline for Contracts: 
#     PDF -> 300 DPI PNG -> Tesseract (Table & Grid Mode)
#     """
#     check_dependencies()
#     pdf_path = Path(pdf_path)
    
#     if not pdf_path.exists():
#         raise FileNotFoundError(f"Source PDF not found: {pdf_path}")

#     all_text = []

#     with tempfile.TemporaryDirectory() as tmp_dir:
#         tmp_path = Path(tmp_dir)
#         logger.info(f"Processing OCR for: {pdf_path.name}")

#         # 1. Convert PDF to Image (High Quality 300 DPI is required for small font numbers)
#         try:
#             pdftoppm_cmd = [
#                 "pdftoppm", # Using name directly since it's in os.environ["PATH"]
#                 "-png",
#                 "-r", "300", 
#                 str(pdf_path),
#                 str(tmp_path / "page")
#             ]
#             subprocess.run(pdftoppm_cmd, check=True, capture_output=True)
#         except subprocess.CalledProcessError as e:
#             logger.error(f"Poppler conversion failed: {e.stderr.decode()}")
#             raise RuntimeError("Failed to convert PDF pages to images.")

#         # 2. Process each page with Tesseract
#         images = sorted(tmp_path.glob("*.png"))
#         for i, img_path in enumerate(images):
#             try:
#                 # --psm 6: Assume a single uniform block of text (Great for tabular contracts)
#                 # --oem 3: Default LSTM engine
#                 # -c preserve_interword_spaces=1: Helps AI identify columns
#                 tess_cmd = [
#                     TESSERACT_EXE,
#                     str(img_path),
#                     "stdout",
#                     "--psm", "3",
#                     "--oem", "3",
#                     "-c", "tessedit_char_whitelist=0123456789ABCDEFGHJKLMNPRSTUVWXYZ", # Excludes I, O, Q
#                     "-c", "preserve_interword_spaces=1"
#                 ]
                
#                 result = subprocess.run(tess_cmd, capture_output=True, check=True, text=True, encoding="utf-8")
#                 page_content = result.stdout
                
#                 if page_content.strip():
#                     logger.info(f"Page {i+1} OCR Successful.")
#                     all_text.append(f"--- PAGE {i+1} ---\n{page_content}")
#                 else:
#                     logger.warning(f"Page {i+1} returned no text. Check if PDF is blank.")
            
#             except subprocess.CalledProcessError as e:
#                 logger.error(f"Tesseract failed on page {i+1}: {e.stderr}")
#                 continue

#     # 3. Final Formatting
#     combined_text = "\n\n".join(all_text)
    
#     # 4. Cleanup & Formatting Integration
#     try:
#         # If your cleaning service is available, use it to fix common OCR typos
#         from app.services.text_processing import clean_text, handle_layout
#         combined_text = handle_layout(clean_text(combined_text))
#     except (ImportError, Exception):
#         logger.warning("Cleaning service skipped. Using raw OCR text.")

#     # Critical Debug: Print a sample of what we found to the console
#     # print(f"--- OCR DEBUG (First 200 chars) ---\n{combined_text[:500]}")
    
#     return combined_text