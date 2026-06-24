"""
src/report.py
─────────────
LLM-powered radiology report generation for NeuroDL v2.1.

Generates a detailed ~2-page clinical report via Groq's hosted LLM API
(OpenAI-compatible /chat/completions endpoint). Swapped from a locally
running Ollama instance so the backend doesn't need to carry an 8B-
parameter model in RAM alongside TensorFlow — Groq's free tier covers
this app's usage comfortably and the model runs on Groq's infra, not
ours.

The report is personalised using the patient's profile + this scan's
symptoms — name, age, gender, symptoms — all injected into the prompt
so the LLM can tailor clinical commentary, risk context, and
recommendations to the actual patient rather than a generic template.

Setup:
    1. Create a free key at https://console.groq.com/keys
    2. Set GROQ_API_KEY in your environment (.env / EC2 env / etc.)

Environment variables:
    GROQ_API_KEY : required — no key, no report (fails gracefully, see below)
    GROQ_MODEL   : model id (default: "llama-3.1-8b-instant" — fast + free-tier
                   friendly; swap to "llama-3.3-70b-versatile" for higher
                   quality at a small latency/cost increase)
"""

import os
import traceback
from datetime import datetime

import requests

# ─── Configuration ────────────────────────────────────────────────────────────

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL   = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

GROQ_ENDPOINT   = "https://api.groq.com/openai/v1/chat/completions"
REQUEST_TIMEOUT = 60   # Groq is far faster than local Ollama inference


# ─── Clinical Knowledge Base ──────────────────────────────────────────────────
# Injected per-class to keep llama3.1:8b radiologically grounded.
# Each entry has: pathology, mri_features, risk_factors, treatment, followup.

CLINICAL_KNOWLEDGE = {
    "Glioma Tumor": {
        "pathology": (
            "Gliomas arise from glial cells (astrocytes, oligodendrocytes, ependymal cells). "
            "Classified WHO Grade I–IV. High-grade glioblastoma (GBM, Grade IV) is the most "
            "aggressive primary brain tumour with median survival of 14–16 months. "
            "Low-grade gliomas (Grade II) grow slowly but carry risk of malignant transformation."
        ),
        "mri_features": (
            "Typical MRI characteristics: irregular hypointense core on T1, hyperintense on T2/FLAIR "
            "reflecting oedema and infiltration. High-grade lesions show heterogeneous ring enhancement "
            "post-contrast with central necrosis. Grad-CAM activation typically localises to the "
            "enhancing tumour margin and surrounding oedematous zone."
        ),
        "risk_factors": (
            "Risk factors include ionising radiation exposure, rare genetic syndromes (NF1, Li-Fraumeni, "
            "Turcot syndrome), and IDH mutation status (IDH-mutant gliomas carry better prognosis). "
            "Age and symptom duration are important prognostic variables."
        ),
        "treatment": (
            "Standard of care for high-grade glioma: maximal safe surgical resection, followed by "
            "concurrent temozolomide chemotherapy and radiotherapy (Stupp protocol, 60 Gy in 30 fractions). "
            "Low-grade: active surveillance or surgery depending on eloquence of location. "
            "Molecular profiling (IDH, MGMT, 1p/19q) is essential for treatment planning."
        ),
        "followup": (
            "MRI surveillance every 2–3 months for high-grade, every 6 months for low-grade. "
            "Multidisciplinary tumour board review strongly recommended. Neurosurgical and "
            "neuro-oncology consultation required within 1–2 weeks of diagnosis."
        ),
        "urgency": "URGENT — immediate neurosurgical consultation recommended.",
    },

    "Meningioma Tumor": {
        "pathology": (
            "Meningiomas originate from arachnoid cap cells of the meningeal layers. ~90% are WHO "
            "Grade I (benign), ~8% Grade II (atypical), ~2% Grade III (anaplastic/malignant). "
            "Most common primary intracranial tumour in adults. Female predominance (2:1 ratio). "
            "Often slow-growing and may be incidental findings on imaging."
        ),
        "mri_features": (
            "Classic MRI appearance: well-defined, homogeneously enhancing extra-axial mass with "
            "broad dural base and dural tail sign. Iso-to-hypointense on T1, iso-to-hyperintense "
            "on T2. Calcification common. Peritumoral oedema variable. Grad-CAM highlights the "
            "enhancing tumour-brain interface and dural attachment."
        ),
        "risk_factors": (
            "Risk factors: prior cranial irradiation, NF2 gene mutation, female hormonal influences "
            "(oestrogen/progesterone receptors present in most meningiomas). Higher rates in older "
            "females. Prior breast cancer associated with increased risk."
        ),
        "treatment": (
            "Grade I: observation with serial MRI for small asymptomatic lesions; surgical resection "
            "(Simpson Grade I–II) for symptomatic or growing tumours. Stereotactic radiosurgery (SRS) "
            "for lesions <3 cm or surgically inaccessible locations. Grade II/III: surgery followed "
            "by adjuvant radiotherapy. Recurrence rates: ~10% Grade I, ~40% Grade II at 10 years."
        ),
        "followup": (
            "Post-surgical MRI at 3 months, then annually for 5 years, then every 2–3 years. "
            "Observation-only cases: MRI every 6–12 months. Neurosurgical outpatient review "
            "within 4 weeks. Ophthalmology review if visual symptoms present."
        ),
        "urgency": "SEMI-URGENT — neurosurgical outpatient review within 2–4 weeks.",
    },

    "Pituitary Tumor": {
        "pathology": (
            "Pituitary adenomas are benign tumours of the anterior pituitary gland. Classified by "
            "size: microadenoma (<10 mm) and macroadenoma (≥10 mm). Functional adenomas secrete "
            "excess hormones (prolactin, GH, ACTH, TSH); non-functional adenomas cause symptoms "
            "via mass effect. Second most common intracranial tumour after meningioma."
        ),
        "mri_features": (
            "Sellar/parasellar mass on MRI. Microadenomas: hypointense on T1 post-contrast with "
            "delayed enhancement relative to normal gland. Macroadenomas: heterogeneous enhancement, "
            "may show suprasellar extension with chiasmal compression, cavernous sinus invasion, "
            "or sphenoid sinus involvement. Grad-CAM activation centred on the sellar region."
        ),
        "risk_factors": (
            "Risk factors: MEN1 syndrome (multiple endocrine neoplasia), Carney complex, McCune-Albright "
            "syndrome. Sporadic cases predominate. Age of presentation varies by subtype: prolactinomas "
            "common in young women, GH-secreting in middle age, non-functional in older adults."
        ),
        "treatment": (
            "Prolactinomas: first-line dopamine agonists (cabergoline, bromocriptine) — highly effective. "
            "Non-functional macroadenomas and other subtypes: transsphenoidal surgery (TSS) via "
            "endoscopic approach. Craniotomy for large suprasellar extension. Adjuvant radiotherapy "
            "or SRS for residual/recurrent disease. Hormone replacement as required post-operatively."
        ),
        "followup": (
            "Endocrinology review within 2 weeks for hormone evaluation. Post-operative MRI at 3 months. "
            "Annual MRI surveillance for 5 years. Ophthalmology formal visual field assessment if "
            "suprasellar extension present. Prolactin, IGF-1, cortisol, thyroid panel as appropriate."
        ),
        "urgency": "URGENT if visual field defects present — otherwise outpatient review within 2 weeks.",
    },

    "No Tumor": {
        "pathology": (
            "No intracranial neoplasm identified on AI-assisted MRI analysis. Brain parenchyma "
            "appears within normal limits with no evidence of space-occupying lesion, abnormal "
            "signal intensity, mass effect, midline shift, or pathological enhancement."
        ),
        "mri_features": (
            "No focal lesion, oedema, or enhancement pattern suggestive of neoplastic process. "
            "Sulcal and gyral pattern appears preserved. Ventricular system within normal size. "
            "Grad-CAM and pseudo-segmentation not applicable — no high-activation region detected."
        ),
        "risk_factors": (
            "Current imaging does not identify a neoplastic cause for the presenting symptoms. "
            "Differential diagnoses for ongoing symptoms may include migraine, vascular pathology, "
            "demyelinating disease, metabolic encephalopathy, or functional neurological disorder — "
            "none of which are reliably detected on this AI tumour-classification model."
        ),
        "treatment": (
            "No tumour-directed treatment indicated based on this scan. If neurological symptoms "
            "persist, further workup is recommended: contrast-enhanced MRI with dedicated sequences "
            "(DWI, SWI, MRS), neurological clinical evaluation, and appropriate laboratory investigations. "
            "EEG if seizure disorder is suspected."
        ),
        "followup": (
            "Clinical correlation essential. If symptoms persist or worsen, neurology outpatient "
            "referral recommended. Repeat imaging in 3–6 months if clinically warranted. "
            "This AI scan result should not delay clinical evaluation."
        ),
        "urgency": "ROUTINE — clinical correlation recommended. No emergency intervention indicated.",
    },
}


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_report(
    class_name:             str,
    confidence:             float,
    segmentation_performed: bool,
    gradcam_performed:      bool,
    model_accuracy:         str  = "94.92%",
    patient_id:             int  = None,
    patient_name:           str  = None,
    patient_age:            int  = None,
    patient_gender:         str  = None,
    patient_symptoms:       str  = None,
) -> str | None:
    """
    Generate a detailed ~2-page clinical radiology report via Groq.

    All patient fields are injected into the prompt so the LLM can
    personalise clinical commentary, risk factors, and recommendations.

    Args:
        class_name             : Predicted class e.g. "Glioma Tumor"
        confidence             : Confidence score as float e.g. 0.9245
        segmentation_performed : Whether pseudo-segmentation ran
        gradcam_performed      : Whether Grad-CAM ran
        model_accuracy         : Model accuracy string
        patient_id             : DB primary key (int)
        patient_name           : Full name from the account (users.full_name)
        patient_age            : Age in years
        patient_gender         : Male / Female / Other
        patient_symptoms       : Free-text reason for THIS scan

    Returns:
        Formatted report string, or None if Groq is unavailable/unconfigured.
        Never crashes the caller — None is handled gracefully (the scan
        still saves; the report panel just shows "not available").
    """
    if not GROQ_API_KEY:
        print("[Report] GROQ_API_KEY not set — skipping report generation. "
              "Get a free key at https://console.groq.com/keys")
        return None

    try:
        prompt = _build_prompt(
            class_name             = class_name,
            confidence             = confidence,
            segmentation_performed = segmentation_performed,
            gradcam_performed      = gradcam_performed,
            model_accuracy         = model_accuracy,
            patient_id             = patient_id,
            patient_name           = patient_name,
            patient_age            = patient_age,
            patient_gender         = patient_gender,
            patient_symptoms       = patient_symptoms,
        )

        payload = {
            "model":       GROQ_MODEL,
            "messages":    [{"role": "user", "content": prompt}],
            "temperature": 0.25,   # Low = consistent, factual, clinical tone
            "top_p":       0.9,
            "max_tokens":  1400,   # ~2 pages of clinical text
        }
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type":  "application/json",
        }

        print(f"[Report] Calling Groq ({GROQ_MODEL}) for full clinical report...")
        response = requests.post(
            GROQ_ENDPOINT,
            json    = payload,
            headers = headers,
            timeout = REQUEST_TIMEOUT,
        )
        response.raise_for_status()

        data        = response.json()
        report_text = data["choices"][0]["message"]["content"].strip()

        if not report_text:
            print("[Report] Groq returned an empty response")
            return None

        print(f"[Report] Generated successfully ({len(report_text)} chars)")
        return report_text

    except requests.exceptions.Timeout:
        print(f"[Report] Groq timed out after {REQUEST_TIMEOUT}s")
        return None
    except requests.exceptions.ConnectionError:
        print("[Report] Cannot connect to Groq — check network / API status")
        return None
    except requests.exceptions.HTTPError as e:
        # 401 = bad/missing key, 429 = rate limit (free tier), etc.
        print(f"[Report] Groq HTTP error: {e} — response: {getattr(e.response, 'text', '')[:300]}")
        return None
    except (KeyError, IndexError):
        print(f"[Report] Unexpected Groq response shape:\n{traceback.format_exc()}")
        return None
    except Exception:
        print(f"[Report] Unexpected error:\n{traceback.format_exc()}")
        return None


# ─── Internal Helpers ─────────────────────────────────────────────────────────


def _build_prompt(
    class_name:             str,
    confidence:             float,
    segmentation_performed: bool,
    gradcam_performed:      bool,
    model_accuracy:         str,
    patient_id:             int  = None,
    patient_name:           str  = None,
    patient_age:            int  = None,
    patient_gender:         str  = None,
    patient_symptoms:       str  = None,
) -> str:
    """
    Build a detailed, patient-personalised prompt for llama3.1:8b.

    Design principles:
      1. Role assignment at the top — model behaves as a radiologist
      2. Full patient context block — personalises all clinical sections
      3. Rich clinical knowledge injected per tumour class
      4. Explicit 8-section template — model follows structure reliably
      5. Hard constraints at the end — no preamble, no commentary
      6. num_predict=1400 gives room for ~2 pages without truncation
    """
    knowledge      = CLINICAL_KNOWLEDGE.get(class_name, CLINICAL_KNOWLEDGE["No Tumor"])
    confidence_pct = f"{confidence:.2%}"
    timestamp      = datetime.utcnow().strftime("%d %B %Y, %H:%M UTC")
    has_tumour     = class_name != "No Tumor"

    # ── Build patient context block ───────────────────────────────
    name_str     = patient_name    or "Not provided"
    age_str      = str(patient_age)  if patient_age    else "Not provided"
    gender_str   = patient_gender  or "Not provided"
    symptom_str  = patient_symptoms or "Not reported"
    pid_str      = f"NeuroDL-{patient_id:04d}" if patient_id else "NeuroDL-XXXX"

    # ── Age-specific risk commentary ──────────────────────────────
    age_context = ""
    if patient_age:
        if patient_age < 18:
            age_context = (
                f"The patient is a paediatric case ({patient_age} years). "
                "Paediatric brain tumours have distinct biology and management pathways. "
                "Paediatric neuro-oncology referral is strongly indicated."
            )
        elif patient_age < 40:
            age_context = (
                f"At {patient_age} years of age, the patient falls in a younger adult demographic. "
                "Younger patients with glioma more commonly carry IDH mutations, conferring better prognosis. "
                "Meningioma at this age may suggest underlying NF2 or hormonal influence."
            )
        elif patient_age < 60:
            age_context = (
                f"At {patient_age} years, the patient is in the middle-adult age group. "
                "This age range sees higher incidence of both high-grade glioma and meningioma. "
                "Pituitary macroadenoma is also common in this demographic."
            )
        else:
            age_context = (
                f"At {patient_age} years, the patient is in the older adult demographic. "
                "Glioblastoma (GBM) peaks in incidence at 55–75 years. "
                "Non-functional pituitary adenomas and meningiomas are also prevalent in this age group. "
                "Surgical fitness and performance status should be carefully evaluated."
            )

    # ── Gender-specific note ──────────────────────────────────────
    gender_context = ""
    if patient_gender:
        if patient_gender.lower() == "female" and has_tumour:
            gender_context = (
                "Female sex is associated with higher incidence of meningioma (2:1 female predominance) "
                "and prolactin-secreting pituitary adenomas. Hormonal factors should be evaluated. "
            )
        elif patient_gender.lower() == "male" and class_name == "Glioma Tumor":
            gender_context = (
                "Male sex carries slightly higher incidence of glioma. "
                "Molecular profiling including IDH mutation and MGMT methylation status is particularly relevant."
            )

    seg_status  = "Performed — high-activation region overlay generated" if segmentation_performed else "Not performed"
    gcam_status = "Performed — activation heatmap generated"             if gradcam_performed      else "Not performed"

    return f"""You are a consultant neuroradiologist generating a formal AI-assisted MRI brain report. Write a detailed, professional clinical report approximately 2 pages long. Use medical terminology appropriate for a specialist audience. Do not add any text before the report header or after the disclaimer. Follow the EXACT section structure below.

═══════════════════════════════════════════════════════
PATIENT & SCAN INFORMATION
═══════════════════════════════════════════════════════
Reference Number  : {pid_str}
Patient Name      : {name_str}
Age               : {age_str}
Gender            : {gender_str}
Presenting Symptoms: {symptom_str}
Scan Date         : {timestamp}
AI System         : NeuroDL v2.0 — ResNet50V2 (Fine-tuned, {model_accuracy} accuracy)
AI Diagnosis      : {class_name}
Confidence Score  : {confidence_pct}
Grad-CAM Analysis : {gcam_status}
Pseudo-Segmentation: {seg_status}

═══════════════════════════════════════════════════════
CLINICAL KNOWLEDGE FOR THIS CASE
═══════════════════════════════════════════════════════
Pathology   : {knowledge["pathology"]}
MRI Features: {knowledge["mri_features"]}
Risk Factors: {knowledge["risk_factors"]}
Treatment   : {knowledge["treatment"]}
Follow-up   : {knowledge["followup"]}
Age Context : {age_context}
Gender Note : {gender_context}
Urgency     : {knowledge["urgency"]}

═══════════════════════════════════════════════════════
WRITE THE REPORT IN EXACTLY THIS FORMAT:
═══════════════════════════════════════════════════════

NEURODL AI-ASSISTED MRI BRAIN REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PATIENT:          {name_str}
AGE / GENDER:     {age_str} years / {gender_str}
REFERENCE NO:     {pid_str}
DATE OF SCAN:     {timestamp}
REPORTING SYSTEM: NeuroDL v2.0 | ResNet50V2 | Accuracy: {model_accuracy}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLINICAL INDICATION:
[Write 2–3 sentences describing why the patient presented for this MRI, incorporating their reported symptoms: "{symptom_str}". If no symptoms reported, state the scan was performed as a screening or incidental workup.]

TECHNIQUE:
[Write 2 sentences describing the AI-assisted MRI analysis technique. Mention that NeuroDL v2.0 used a fine-tuned ResNet50V2 classifier at 224×224 resolution, with Grad-CAM explainability and pseudo-segmentation overlay where applicable.]

FINDINGS:
[Write 4–6 sentences. Describe what the AI detected: the specific tumour type or absence of tumour, its typical MRI characteristics based on the clinical knowledge above, what the confidence score of {confidence_pct} indicates about the certainty of the result, and what the Grad-CAM/segmentation analysis revealed. Be specific and clinical. Reference the patient's age and gender where relevant to the pathology.]

PATHOLOGICAL CORRELATION:
[Write 3–4 sentences explaining the underlying pathology of {class_name} — what type of cells are involved, the WHO grading context, typical biological behaviour, and how this correlates with the MRI appearance detected by the AI system.]

CLINICAL RISK ASSESSMENT:
[Write 3–4 sentences. Assess the clinical significance for THIS patient specifically — incorporate their age ({age_str}), gender ({gender_str}), and symptoms ("{symptom_str}"). Discuss relevant risk factors, prognostic considerations, and what the demographic context means for this diagnosis. Include the age and gender context from the clinical knowledge.]

RECOMMENDATIONS:
[Write 4–5 sentences as a numbered or flowing paragraph. Provide specific clinical recommendations based on {class_name}: who the patient should see (specialist), what additional tests are needed, what urgency applies, and what treatment pathway is likely. Reference the urgency level: {knowledge["urgency"]}]

FOLLOW-UP PLAN:
[Write 2–3 sentences specifying the follow-up imaging schedule, clinical review timeline, and any specialist referrals needed based on the follow-up guidance above.]

AI SYSTEM PERFORMANCE NOTE:
[Write 2 sentences noting that NeuroDL v2.0 achieved {model_accuracy} classification accuracy on the test dataset, that the confidence of {confidence_pct} for this result {"indicates high model certainty" if confidence > 0.85 else "indicates moderate model certainty — independent radiological review is particularly important"}, and that Grad-CAM and pseudo-segmentation were used to provide spatial explainability of the AI decision.]

DISCLAIMER:
This report has been generated by NeuroDL v2.0, an AI-assisted research tool, and is intended for educational and research purposes only. It has not been validated for clinical diagnostic use and does not constitute a formal radiological or medical diagnosis. All findings must be independently reviewed and verified by a qualified radiologist or clinician before any clinical decision is made. The AI prediction should be considered as decision-support only and must not replace professional medical judgement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF REPORT — NeuroDL v2.0 | {timestamp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write every section fully. Do not skip any section. Do not add commentary outside the report structure."""