"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import HeatmapViewer from "./HeatmapViewer";
import ReportPanel from "./ReportPanel";
import ProbabilityChart from "./ProbabilityChart";
import InferenceProgress, { STEP_DEFINITIONS } from "./InferenceProgress";
import { useToast } from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext";
import GradCAMComparison from "./GradCAMComparison";

/**
 * APIRequest.jsx  —  NeuroDL v2.0
 * ────────────────────────────────
 * Sends MRI to /predict with JWT auth and patient_id.
 * Connects to Flask-SocketIO to receive live inference progress events.
 *
 * Socket protocol:
 *   client emits  → 'join' { socket_id }          (register session)
 *   server emits  → 'progress' { step, status,
 *                                message, duration } (per pipeline step)
 *
 * Props:
 *   image     (File)       — selected MRI file
 *   patientId (int | null) — FK from /patients
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// Steps in pipeline order (must match backend emit IDs)
const INITIAL_STEPS = STEP_DEFINITIONS.map((d) => ({
  id: d.id,
  label: d.label,
  status: "idle", // idle | running | done | error
  duration: null,
}));

const tumorInfo = {
  0: {
    name: "Glioma Tumor",
    content: `## Glioma Tumor\n\n**Description**: Aggressive malignant brain tumor from glial cells requiring multi-modal treatment.\n\n**Action**: Consult neurosurgeon and oncologist immediately for personalized treatment plan.\n\n**Implications**: May cause seizures, cognitive difficulties, and functional impairment.`,
  },
  1: {
    name: "Meningioma Tumor",
    content: `## Meningioma Tumor\n\n**Description**: Usually benign tumor from protective brain layers. 90% are non-cancerous.\n\n**Action**: Consult neurosurgeon for evaluation. Regular MRI monitoring recommended.\n\n**Implications**: May cause headaches, vision problems, and neurological symptoms if untreated.`,
  },
  2: {
    name: "No Tumor",
    content: `## No Tumor Detected\n\n**Description**: No abnormal growths identified. Healthy brain tissue with normal structures.\n\n**Action**: Maintain regular health check-ups as advised by your healthcare provider.\n\n**Note**: If experiencing symptoms, consult your doctor for comprehensive evaluation.`,
  },
  3: {
    name: "Pituitary Tumor",
    content: `## Pituitary Tumor\n\n**Description**: Usually benign adenoma affecting pituitary gland and hormone production.\n\n**Action**: Consult endocrinologist for hormonal evaluation and treatment options.\n\n**Implications**: May cause vision changes, hormonal imbalances, and headaches.`,
  },
};

const APIRequest = ({ image, patientId = null }) => {
  const { authFetch } = useAuth();
  const toast = useToast();

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [elapsed, setElapsed] = useState(0);

  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const stepStartRef = useRef({}); // step_id → Date.now()

  // ── Cleanup on unmount ─────────────────────────────────────────
  useEffect(
    () => () => {
      socketRef.current?.disconnect();
      clearInterval(timerRef.current);
    },
    [],
  );

  // ── Socket setup ───────────────────────────────────────────────
  const connectSocket = async () => {
    // Lazy-load socket.io-client to keep bundle small
    const { io } = await import("socket.io-client");

    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 3,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] connected:", socket.id);
    });

    socket.on("progress", (data) => {
      const { step, status, message, duration } = data;

      if (status === "running") {
        stepStartRef.current[step] = Date.now();
      }

      setSteps((prev) =>
        prev.map((s) => {
          if (s.id !== step) return s;
          const dur =
            status === "done" && stepStartRef.current[step]
              ? (Date.now() - stepStartRef.current[step]) / 1000
              : s.duration;
          return {
            ...s,
            status,
            message: message || s.message,
            duration: dur ?? s.duration,
          };
        }),
      );
    });

    socket.on("disconnect", () => {
      console.log("[Socket] disconnected");
    });

    // Wait until connected before returning socket id
    return new Promise((resolve) => {
      if (socket.connected) {
        resolve(socket.id);
        return;
      }
      socket.once("connect", () => resolve(socket.id));
      // Fallback: if socket fails to connect, still proceed
      setTimeout(() => resolve(null), 2500);
    });
  };

  // ── Send request ───────────────────────────────────────────────
  const sendRequest = async () => {
    setLoading(true);
    setResponse(null);
    setSteps(INITIAL_STEPS);
    setElapsed(0);

    // Start elapsed timer
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 100);

    // Connect socket, get session id
    const socketId = await connectSocket();

    const formData = new FormData();
    formData.append("image", image);
    if (patientId != null) formData.append("patient_id", String(patientId));
    if (socketId) formData.append("socket_id", socketId);

    try {
      const res = await authFetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const result = tumorInfo[data.final_class];
      if (result) data.class_name = result.name;

      setResponse({ ...data, _info: result?.content });

      toast({
        title: "Analysis Complete",
        description: `Detected: ${result?.name || "Unknown"}${data.scan_id ? ` · Scan #${data.scan_id}` : ""}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      console.error(err);
      setResponse({ error: err.message });
      // Mark current running step as error
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "error" } : s,
        ),
      );
      toast({
        title: "Analysis Failed",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      clearInterval(timerRef.current);
      setLoading(false);
      socketRef.current?.disconnect();
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-8 mt-8">
      {/* ── Analyse button ── */}
      <div className="text-center">
        <button
          onClick={sendRequest}
          disabled={loading}
          className={`btn ${loading ? "btn-disabled" : "btn-primary"} text-lg px-12 py-4`}
        >
          {loading ? (
            <span className="flex items-center gap-3">
              <svg
                className="spinning"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Analysing…
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              Analyse Now
            </span>
          )}
        </button>

        {patientId && (
          <p
            style={{
              marginTop: 8,
              fontSize: "0.78rem",
              color: "var(--color-text-light)",
            }}
          >
            Result will be saved under Patient #{patientId}
          </p>
        )}
      </div>

      {/* ── Live inference progress ── */}
      {loading && <InferenceProgress steps={steps} elapsed={elapsed} />}

      {/* ── Results ── */}
      {response && !response.error && (
        <div className="fade-in space-y-8">
          {/* Diagnosis badge */}
          <div className="text-center">
            <div className="result-badge inline-flex">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Diagnosis: {response.class_name}</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <span className="badge badge-primary">
                Confidence: {response.confidence}
              </span>
              <span className="badge badge-info">
                Model: {response.model_used}
              </span>
              <span className="badge badge-success">
                Accuracy: {response.model_accuracy}
              </span>
              {response.gradcam_performed && (
                <span className="badge badge-success">✓ Grad-CAM</span>
              )}
              {response.segmentation_performed && (
                <span className="badge badge-info">✓ Segmentation</span>
              )}
              {response.scan_id && (
                <span
                  className="badge"
                  style={{
                    background: "var(--color-bg-tertiary)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Scan #{response.scan_id}
                </span>
              )}
              {response.patient_id && (
                <span
                  className="badge"
                  style={{
                    background: "#f0fdf4",
                    color: "#15803d",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  Patient #{response.patient_id}
                </span>
              )}
            </div>
          </div>

          {/* Probability chart */}
          {response.class_probabilities && (
            <ProbabilityChart
              probabilities={response.class_probabilities}
              predictedClass={response.class_name}
              uncertainty={response.uncertainty || null}
            />
          )}

          {/* Heatmap viewer */}
          <HeatmapViewer
            image={image}
            gradcamImage={response.gradcam_image}
            segmentImage={response.segment_image}
            className={response.class_name}
          />
          {response && !response.error && (
            <GradCAMComparison image={image} className={response.class_name} />
          )}

          {/* LLM Report */}
          <ReportPanel report={response.report} loading={false} />

          {/* Tumour info markdown */}
          {response._info && (
            <div className="info-section markdown-content">
              <ReactMarkdown>{response._info}</ReactMarkdown>
            </div>
          )}

          {/* Medical disclaimer */}
          <div className="alert alert-warning">
            <svg
              className="w-6 h-6 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-bold mb-1">Important Medical Notice</p>
              <p className="text-sm leading-relaxed">
                This is for research and education only. Not for clinical
                diagnosis. Always consult qualified healthcare professionals for
                medical advice.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {response?.error && (
        <div className="alert alert-error">
          <svg
            className="w-6 h-6 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-bold mb-1">Analysis Error</p>
            <p className="text-sm">{response.error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIRequest;
