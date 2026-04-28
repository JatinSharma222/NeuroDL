"""
src/report.py
─────────────
LLM-powered radiology report generation for NeuroDL v2.0 (Upgrade 3).

Uses a locally running Ollama instance (llama3.1:8b) — no external API
key required, fully offline.

Ollama must be running before starting the Flask server:
    ollama serve
    ollama pull llama3.1:8b

Environment variables (optional — defaults work for local dev):
    OLLAMA_URL   : Base URL of Ollama server  (default: http://localhost:11434)
    OLLAMA_MODEL : Model name to use          (default: llama3.1:8b)
"""

import os
import traceback
from datetime import datetime

import requests

# ─── Constants ────────────────────────────────────────────────────────────────

OLLAMA_URL   = os.environ.get("OLLAMA_URL",   "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")

GENERATE_ENDPOINT = f"{OLLAMA_URL}/api/generate"

REQUEST_TIMEOUT = 60  # seconds — llama3.1:8b can be slow on first run

# ── Tumour-specific clinical context ──────────────────────────────────────────
# Injected into the prompt to keep the smaller model radiologically accurate
TUMOUR_CONTEXT = {
    "Glioma Tumor": (
        "Gliomas arise from glial cells. High-grade gliomas (WHO III-IV) are aggressive "
        "with rapid growth. MRI shows irregular enhancement with surrounding oedema on "
        "T2/FLAIR. Treatment: surgical resection, radiation, and temozolomide chemotherapy."
    ),
    "Meningioma Tumor": (
        "Meningiomas originate from meningeal layers. ~90% are benign (WHO Grade I), "
        "slow-growing, often incidental. MRI shows well-defined homogeneously enhancing "
        "extra-axial mass with dural tail sign. Management: surveillance, surgery, or radiosurgery."
    ),
    "Pituitary Tumor": (
        "Pituitary adenomas are benign tumours of the anterior pituitary. Classified as "
        "micro (<10mm) or macro (>=10mm). May secrete excess hormones or cause visual deficits "
        "via mass effect. MRI shows sellar/parasellar mass. Treatment: dopamine agonists, "
        "transsphenoidal surgery, or radiotherapy."
    ),
    "No Tumor": (
        "No intracranial neoplasm identified. Brain parenchyma appears within normal limits "
        "with no abnormal signal, mass effect, or pathological enhancement detected."
    ),
}


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_report(
    class_name: str,
    confidence: float,
    segmentation_performed: bool,
    gradcam_performed: bool,
    model_accuracy: str = "84.13%",
    patient_id: str = None,
) -> str | None:
    """
    Generate a structured radiology-style report using local Ollama LLM.

    Args:
        class_name             : Predicted class e.g. "Glioma Tumor"
        confidence             : Confidence score as float e.g. 0.9245
        segmentation_performed : Whether U-Net segmentation was run
        gradcam_performed      : Whether Grad-CAM heatmap was generated
        model_accuracy         : Reported model accuracy string
        patient_id             : Optional patient identifier string

    Returns:
        Formatted report string, or None if generation fails.
        A None return never crashes the prediction — caller handles gracefully.
    """
    if not _check_ollama():
        return None

    try:
        prompt = _build_prompt(
            class_name, confidence, segmentation_performed,
            gradcam_performed, model_accuracy, patient_id,
        )

        payload = {
            "model":  OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,        # Get full response at once
            "options": {
                "temperature": 0.3, # Low temp = consistent, factual output
                "top_p":       0.9,
                "num_predict": 600, # Max tokens — enough for the report
            },
        }

        print(f"[Report] Calling Ollama ({OLLAMA_MODEL})...")
        response = requests.post(
            GENERATE_ENDPOINT,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()

        data        = response.json()
        report_text = data.get("response", "").strip()

        if not report_text:
            print("[Report] Ollama returned empty response")
            return None

        print(f"[Report] Generated successfully ({len(report_text)} chars)")
        return report_text

    except requests.exceptions.Timeout:
        print(f"[Report] Ollama request timed out after {REQUEST_TIMEOUT}s")
        return None

    except requests.exceptions.ConnectionError:
        print("[Report] Cannot connect to Ollama. Is 'ollama serve' running?")
        return None

    except requests.exceptions.HTTPError as e:
        print(f"[Report] Ollama HTTP error: {e}")
        return None

    except Exception:
        print(f"[Report] Unexpected error:\n{traceback.format_exc()}")
        return None


# ─── Internal Helpers ─────────────────────────────────────────────────────────

def _check_ollama() -> bool:
    """
    Quick health check — ping Ollama before sending the full request.
    Avoids a long timeout wait if Ollama isn't running at all.

    Returns:
        True if Ollama is reachable and model is pulled, False otherwise.
    """
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if response.status_code == 200:
            models     = [m["name"] for m in response.json().get("models", [])]
            base_name  = OLLAMA_MODEL.split(":")[0]
            model_available = any(base_name in m for m in models)
            if not model_available:
                print(
                    f"[Report] Model '{OLLAMA_MODEL}' not found in Ollama. "
                    f"Run: ollama pull {OLLAMA_MODEL}"
                )
                return False
            return True
    except requests.exceptions.ConnectionError:
        print("[Report] Ollama not reachable. Run: ollama serve")
    except Exception:
        print(f"[Report] Ollama health check failed:\n{traceback.format_exc()}")

    return False


def _build_prompt(
    class_name: str,
    confidence: float,
    segmentation_performed: bool,
    gradcam_performed: bool,
    model_accuracy: str,
    patient_id: str | None,
) -> str:
    """
    Build a concise, direct prompt optimised for llama3.1:8b.

    Smaller models perform better with:
    - Clear instruction at the top
    - Short focused clinical context
    - Explicit output template to follow
    - Hard closing instruction

    Args:
        class_name             : Predicted class name
        confidence             : Raw confidence float
        segmentation_performed : Whether U-Net ran
        gradcam_performed      : Whether Grad-CAM ran
        model_accuracy         : Model accuracy string
        patient_id             : Optional patient identifier

    Returns:
        str: Prompt string ready to send to Ollama
    """
    confidence_pct = f"{confidence:.2%}"
    timestamp      = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    patient_ref    = patient_id if patient_id else "Not provided"
    tumour_context = TUMOUR_CONTEXT.get(class_name, "No additional context.")
    seg_status     = "Yes" if segmentation_performed else "No"
    gcam_status    = "Yes" if gradcam_performed else "No"

    return f"""You are a radiology report generator. Write a professional radiology report based on the AI scan results below. Follow the exact format shown. Be concise and accurate. Do not add any commentary before or after the report.

AI SCAN RESULTS:
- Date: {timestamp}
- Patient ID: {patient_ref}
- AI System: NeuroDL v2.0 (ResNet50V2, accuracy: {model_accuracy})
- Predicted diagnosis: {class_name}
- Confidence: {confidence_pct}
- Segmentation performed: {seg_status}
- Grad-CAM performed: {gcam_status}

CLINICAL CONTEXT:
{tumour_context}

Write the report in EXACTLY this format:

EXAMINATION: MRI Brain (AI-Assisted Analysis)
DATE: {timestamp}
SYSTEM: NeuroDL v2.0 | ResNet50V2 | Accuracy: {model_accuracy}

FINDINGS:
[3-4 sentences describing the detected condition, its typical MRI characteristics, and what the confidence score indicates.]

IMPRESSION:
[1-2 sentences with the most likely diagnosis and recommended next step.]

DISCLAIMER:
This report is generated by an AI system for research and educational purposes only. It must be independently verified by a qualified medical professional before any clinical decision is made."""