'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEMO_CASES, DemoCaseConfig, demoCaseToScreening, getDemoCase, createExternalFundusCase } from '@/data/prototypeCases';
import { analyzeUploadedImage, loadImageElement } from '@/lib/imageAnalyzer';
import { useSessionStore } from '@/hooks/useSessionStore';
import { generateReport } from '@/lib/generateReport';
import { CanvasImageViewer } from '@/components/CanvasImageViewer';
import { PatientDetailsModal } from '@/components/PatientDetailsModal';
import { EssentialPatientDetails } from '@/types/screening';
import { sound } from '@/lib/sound';
import {
  UploadCloud,
  CheckCircle2,
  Eye,
  Activity,
  RefreshCw,
  UserCheck,
  Download,
  ShieldCheck,
  ArrowRight,
  Flame,
  AlertTriangle,
  Camera,
  Sparkles,
  Info,
} from 'lucide-react';

function ScreeningInner() {
  const searchParams = useSearchParams();
  const caseParam = searchParams?.get('case');
  const { screenCase, submitReview, markReportGenerated } = useSessionStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialCase = (caseParam && getDemoCase(caseParam)) || DEMO_CASES[2];
  const [selectedCase, setSelectedCase] = useState<DemoCaseConfig>(initialCase);
  const [mobileIntakeTab, setMobileIntakeTab] = useState<'demo' | 'upload'>('demo');
  const [screenState, setScreenState] = useState<'idle' | 'scanning' | 'result' | 'rejected'>('idle');
  const [scanStepIndex, setScanStepIndex] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [reviewerNote, setReviewerNote] = useState<string>('');
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState<boolean>(false);
  const [overrideGrade, setOverrideGrade] = useState<number>(2);
  const [isAuditTrailExpanded, setIsAuditTrailExpanded] = useState<boolean>(true);
  const [matchedBenchmarkInfo, setMatchedBenchmarkInfo] = useState<{
    screeningId: string;
    demoNumber: string;
    caseTitle: string;
    matchReason: string;
  } | null>(null);

  const selectCase = (c: DemoCaseConfig) => {
    setSelectedCase(c);
    setReviewerNote(c.reviewDecision?.comments || '');
    setOverrideGrade(c.drGrade);
    setIsOverrideOpen(false);
    setReviewFeedback(null);
  };

  useEffect(() => {
    if (caseParam) {
      const found = getDemoCase(caseParam);
      if (found) {
        selectCase(found);
      }
    }
  }, [caseParam]);

  const scanSequence = [
    'Optical Verification: Evaluating 45° posterior pole chromaticity & aperture...',
    'OpenCV Quality Gate: Computing Laplacian focus variance & glare metrics...',
    'Vessel Segmentation: Extracting green-channel morphological vascular tree...',
    'Clinical Database: Cross-referencing verified benchmark signatures...',
    'Multi-task Analysis: Evaluating ICDR triage threshold & confidence...',
    'Decision Calibration: Synthesizing multi-layer diagnostic workbench...',
  ];

  const runScanSequence = (targetCase: DemoCaseConfig) => {
    setScreenState('scanning');
    setScanStepIndex(0);
    setReviewFeedback(null);

    let current = 0;
    const interval = setInterval(() => {
      current++;
      setScanStepIndex(current);
      sound.playHover(400 + current * 80);
      if (current >= scanSequence.length) {
        clearInterval(interval);
        setTimeout(() => {
          sound.playClick(1000);
          setScreenState('result');
          screenCase(targetCase);
        }, 350);
      }
    }, 320);
  };

  const handleStartScan = (dc?: DemoCaseConfig) => {
    sound.playClick(900);
    const targetCase = dc || selectedCase;
    selectCase(targetCase);
    setMatchedBenchmarkInfo(null);
    setRejectionReason(null);
    runScanSequence(targetCase);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadFile(file);
  };

  const handleUploadFile = async (file: File) => {
    sound.playClick(780);
    setRejectionReason(null);
    setMatchedBenchmarkInfo(null);

    // 1. Basic format & size check
    if (!file.type.startsWith('image/')) {
      setRejectionReason('Invalid file format. Please upload a standard retinal fundus photograph (.jpg, .png).');
      setScreenState('rejected');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setRejectionReason('File exceeds 15MB limit. Please upload a compressed clinical retinal photograph.');
      setScreenState('rejected');
      return;
    }

    // Set temporary scanning state while optical checks execute
    setScreenState('scanning');
    setScanStepIndex(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const src = e.target?.result as string;
      try {
        const img = await loadImageElement(src);
        const analysis = await analyzeUploadedImage(img, { name: file.name, size: file.size });

        if (!analysis.isRetinalFundus) {
          // INTERCEPT: Non-retinal image detected!
          sound.playClick(400);
          setRejectionReason(
            analysis.rejectionReason ||
            'The uploaded image does not exhibit 45° posterior pole retinal optical chromaticity (foveal/vascular red reflectance) or circular aperture borders.'
          );
          setScreenState('rejected');
          return;
        }

        const patientAlias = `PAT-${file.name.replace(/\.[^/.]+$/, '').slice(0, 8).toUpperCase()}`;

        // Case A: Matched verified benchmark clinical case
        if (analysis.matchedBenchmark) {
          const matched = DEMO_CASES.find(
            (c) => c.screeningId === analysis.matchedBenchmark?.screeningId
          );
          if (matched) {
            setMatchedBenchmarkInfo({
              screeningId: analysis.matchedBenchmark.screeningId,
              demoNumber: analysis.matchedBenchmark.demoNumber,
              caseTitle: analysis.matchedBenchmark.caseTitle,
              matchReason: analysis.matchedBenchmark.matchReason,
            });
            const enrichedCase: DemoCaseConfig = {
              ...matched,
              patientAlias,
              rawImageUrl: src,
            };
            selectCase(enrichedCase);
            runScanSequence(enrichedCase);
            return;
          }
        }

        // Case B: Genuine retinal fundus photograph (external/unknown scan)
        const customCase = createExternalFundusCase({
          rawImageUrl: src,
          patientAlias,
          analysis,
        });
        selectCase(customCase);
        runScanSequence(customCase);
      } catch (err) {
        console.error('Optical analysis error:', err);
        setRejectionReason('Failed to process image optics. Please ensure the file is an uncorrupted JPEG or PNG.');
        setScreenState('rejected');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReviewAction = (
    action: 'CONFIRMED' | 'RE_REVIEW' | 'UNGRADABLE' | 'OVERRIDDEN',
    label: string,
    chosenOverrideGrade?: number
  ) => {
    sound.playClick(850);
    const now = new Date().toISOString();
    const gradeLabels = ['No DR', 'Mild DR', 'Moderate DR', 'Severe DR', 'Proliferative DR'];

    let updatedGrade = selectedCase.drGrade;
    let updatedGradeLabel = selectedCase.drGradeLabel;
    let updatedReferable = selectedCase.referable;
    let updatedQualityStatus = selectedCase.qualityStatus;
    let auditAction: 'REVIEW_COMPLETED' | 'OVERRIDDEN' | 'MARKED_UNGRADABLE' = 'REVIEW_COMPLETED';
    let auditDetails = `Specialist Sign-off: Confirmed ${selectedCase.drGradeLabel}. Notes: "${reviewerNote.trim() || 'Grade confirmed based on retinal morphology.'}"`;

    if (action === 'OVERRIDDEN') {
      const g = chosenOverrideGrade !== undefined ? chosenOverrideGrade : overrideGrade;
      updatedGrade = g as 0 | 1 | 2 | 3 | 4;
      updatedGradeLabel = `${gradeLabels[g]} (Clinician Override)`;
      updatedReferable = g >= 2;
      auditAction = 'OVERRIDDEN';
      auditDetails = `Specialist Clinical Override: Grade altered to ${gradeLabels[g]} (Grade ${g}). Rationale: "${reviewerNote.trim() || 'Clinical signs differ from automated interpretation.'}"`;
    } else if (action === 'UNGRADABLE') {
      updatedQualityStatus = 'UNGRADABLE';
      auditAction = 'MARKED_UNGRADABLE';
      auditDetails = `Specialist Request Retake: Marked Ungradable. Reason: "${reviewerNote.trim() || 'Diagnostic focus/sharpness insufficient.'}"`;
    }

    const newAuditEvent = {
      id: `AUD-${Date.now()}`,
      timestamp: now,
      actorId: 'DR-SPECIALIST-01',
      actorRole: 'reviewer' as const,
      action: auditAction,
      details: auditDetails,
    };

    const updatedDecision = {
      reviewerId: 'DR-SPECIALIST-01',
      reviewerName: 'Dr. Specialist (Ophthalmologist)',
      action,
      overrideGrade: action === 'OVERRIDDEN' ? (chosenOverrideGrade !== undefined ? chosenOverrideGrade : overrideGrade) : undefined,
      comments: reviewerNote.trim() || (action === 'CONFIRMED' ? 'Confirmed by specialist' : action === 'OVERRIDDEN' ? `Overridden to ${updatedGradeLabel}` : 'Flagged ungradable'),
      reviewedAt: now,
    };

    const updatedCase: DemoCaseConfig = {
      ...selectedCase,
      drGrade: updatedGrade,
      drGradeLabel: updatedGradeLabel,
      referable: updatedReferable,
      qualityStatus: updatedQualityStatus,
      reviewStatus: action === 'CONFIRMED' ? 'REVIEW_COMPLETED' : action === 'OVERRIDDEN' ? 'OVERRIDDEN' : 'UNGRADABLE',
      reviewDecision: updatedDecision,
      auditTrail: [
        ...(selectedCase.auditTrail || []),
        newAuditEvent,
      ],
    };

    setSelectedCase(updatedCase);

    submitReview(selectedCase.screeningId, {
      reviewerId: 'DR-SPECIALIST-01',
      action,
      overrideGrade: action === 'OVERRIDDEN' ? (chosenOverrideGrade !== undefined ? chosenOverrideGrade : overrideGrade) : undefined,
      comments: updatedDecision.comments,
      reviewedAt: now,
    });

    setReviewFeedback(`Clinical action registered: ${label}`);
    setTimeout(() => setReviewFeedback(null), 4000);
    setIsOverrideOpen(false);
  };

  const [isPatientModalOpen, setIsPatientModalOpen] = useState<boolean>(false);

  const handleDownloadPDF = () => {
    sound.playClick(950);
    setIsPatientModalOpen(true);
  };

  const handleConfirmPatientDetails = async (details: EssentialPatientDetails) => {
    sound.playClick(900);
    setIsDownloading(true);
    try {
      const screening = demoCaseToScreening(selectedCase);
      screening.patientDetails = details;
      
      // Pass active review decision or active specialist observation
      if (selectedCase.reviewDecision) {
        screening.reviewDecision = {
          reviewerId: selectedCase.reviewDecision.reviewerId,
          action: selectedCase.reviewDecision.action,
          overrideGrade: selectedCase.reviewDecision.overrideGrade,
          comments: selectedCase.reviewDecision.comments,
          reviewedAt: selectedCase.reviewDecision.reviewedAt,
        };
      } else if (reviewerNote.trim()) {
        screening.reviewDecision = {
          reviewerId: 'DR-SPECIALIST-01',
          action: 'CONFIRMED',
          comments: reviewerNote.trim(),
          reviewedAt: new Date().toISOString(),
        };
      }

      await generateReport(screening);
      markReportGenerated(screening.screeningId);
      setIsPatientModalOpen(false);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] pt-24 sm:pt-32 pb-28 sm:pb-32 px-4 sm:px-8 max-w-[1360px] mx-auto selection:bg-[var(--ink)] selection:text-[var(--accent)]">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[var(--ink)] mb-8 sm:mb-10">
        <div>
          <div className="font-mono text-xs tracking-widest uppercase text-[var(--ink-soft)] mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--ink)] animate-pulse" />
            Decision Support Intake
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight uppercase">
            Retinal Screening &amp; Inference
          </h1>
        </div>

        {(screenState === 'result' || screenState === 'rejected') && (
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setScreenState('idle');
              setReviewFeedback(null);
              setRejectionReason(null);
              setMatchedBenchmarkInfo(null);
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full border-2 border-[var(--ink)] bg-[var(--paper)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-[3px_3px_0_var(--ink)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Select Another Case</span>
          </button>
        )}
      </div>

      {/* Shared Hidden File Input - mounted permanently so accessible across idle, rejected, and result states */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadFile(file);
          // Reset so re-uploading the same file still triggers onChange
          e.target.value = '';
        }}
      />

      {/* ─── STAGE 1: INTAKE DROPZONE & PRECONFIGURED BENCHMARK PASSES ─── */}
      {screenState === 'idle' && (
        <div>
          {/* ────── MOBILE-ONLY CURATED WORKFLOW (<640px) ────── */}
          <div className="sm:hidden space-y-4">
            {/* Mobile Intake Switcher (Demo vs Upload) */}
            <div className="flex items-center p-1 rounded-2xl bg-[var(--paper)] border-2 border-[var(--ink)] shadow-[3px_3px_0_var(--ink)]">
              <button
                type="button"
                onClick={() => {
                  sound.playClick(600);
                  setMobileIntakeTab('demo');
                }}
                className={`flex-1 py-2 px-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  mobileIntakeTab === 'demo'
                    ? 'bg-[var(--ink)] text-[var(--accent)] shadow-sm'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Demo Cases (5)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick(600);
                  setMobileIntakeTab('upload');
                }}
                className={`flex-1 py-2 px-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  mobileIntakeTab === 'upload'
                    ? 'bg-[var(--ink)] text-[var(--accent)] shadow-sm'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Scan</span>
              </button>
            </div>

            {/* Mobile Mode A: Upload */}
            {mobileIntakeTab === 'upload' && (
              <div
                onClick={() => {
                  sound.playClick(600);
                  fileInputRef.current?.click();
                }}
                className="p-6 rounded-3xl border-[2.5px] border-dashed border-[var(--ink)] bg-[var(--paper)] text-center cursor-pointer shadow-[5px_5px_0_var(--ink)] active:scale-[0.99] transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--ink)] text-[var(--accent)] flex items-center justify-center mx-auto mb-3 shadow-md">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold">Select Retinal Fundus Image</h3>
                <p className="text-xs text-[var(--ink-soft)] mt-1 mb-4">
                  Tap to choose from photo library or camera (.jpg, .png)
                </p>
                <div className="flex flex-col gap-2">
                  <div className="py-2.5 px-4 rounded-full bg-[var(--ink)] text-[var(--accent)] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm">
                    <Camera className="w-4 h-4" />
                    <span>Choose Photo / Camera</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--ink-soft)] uppercase">
                    Automated Quality Gate Runs on Upload
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Mode B: Demonstration Cases (Zero-Scroll Hassle-Free Selection) */}
            {mobileIntakeTab === 'demo' && (
              <div className="space-y-4">
                {/* Quick Case Switcher Strip */}
                <div>
                  <div className="flex justify-between items-center mb-2 font-mono text-[11px] text-[var(--ink-soft)]">
                    <span>SELECT CASE (1 TAP):</span>
                    <span className="font-bold text-[var(--ink)]">{selectedCase.demoNumber} Selected</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {DEMO_CASES.map((c) => {
                      const isSelected = selectedCase.screeningId === c.screeningId;
                      return (
                        <button
                          key={c.screeningId}
                          type="button"
                          onClick={() => {
                            sound.playClick(720);
                            selectCase(c);
                          }}
                          className={`px-3 py-1.5 rounded-full font-mono text-[11px] uppercase font-bold shrink-0 transition-all ${
                            isSelected
                              ? 'bg-[var(--ink)] text-[var(--accent)] shadow-[2px_2px_0_var(--ink)]'
                              : 'bg-[var(--paper)] text-[var(--ink)] border border-[var(--ink)]'
                          }`}
                        >
                          {c.demoNumber}: {c.drGradeLabel.split(':')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Horizontal Snap Reel */}
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 no-scrollbar">
                  {DEMO_CASES.map((c) => {
                    const isSelected = selectedCase.screeningId === c.screeningId;
                    return (
                      <div
                        key={c.screeningId}
                        onClick={() => {
                          sound.playClick(720);
                          setSelectedCase(c);
                        }}
                        className={`w-[82vw] max-w-[310px] shrink-0 snap-center p-4 rounded-2xl border-[2.5px] border-[var(--ink)] cursor-pointer transition-all flex flex-col justify-between select-none ${
                          isSelected
                            ? 'bg-[var(--ink)] text-[var(--accent)] shadow-[5px_5px_0_var(--ink)]'
                            : 'bg-[var(--paper)] text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center font-mono text-[10px] uppercase font-bold mb-1.5">
                            <span>{c.demoNumber}</span>
                            <span className="underline">{c.drGradeLabel}</span>
                          </div>
                          <div className="font-bold text-sm mb-1 leading-snug">{c.title}</div>
                          <p className="text-[11px] opacity-80 line-clamp-2">{c.description}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-current/20 flex items-center justify-between font-mono text-[10px]">
                          <span>Quality: {c.qualityStatus}</span>
                          <span className="font-bold">{c.confidenceValue}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Launch Button: Positioned immediately below cards for zero-scroll activation */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleStartScan()}
                    className="w-full py-3.5 px-6 rounded-full bg-[var(--ink)] text-[var(--accent)] font-extrabold text-sm tracking-tight shadow-[5px_5px_0_var(--ink)] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Start Inference ({selectedCase.demoNumber})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ────── DESKTOP / TABLET WORKFLOW (>=640px UNTOUCHED PC UI) ────── */}
          <div className="hidden sm:block space-y-12">
            {/* Tactical Drag & Drop Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => {
                sound.playClick(600);
                fileInputRef.current?.click();
              }}
              className={`p-16 rounded-3xl border-[2.5px] border-dashed border-[var(--ink)] text-center cursor-pointer transition-all duration-300 ${
                isDragOver
                  ? 'bg-[var(--accent)] scale-[1.01] shadow-[8px_8px_0_var(--ink)]'
                  : 'bg-[var(--paper)] hover:bg-[var(--accent)]/40 shadow-[6px_6px_0_var(--ink)]'
              }`}
              data-cursor-label="DROP"
            >
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ink)] text-[var(--accent)] flex items-center justify-center mx-auto shadow-lg">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Upload Retinal Fundus Photograph</h3>
                  <p className="text-sm text-[var(--ink-soft)] mt-1 font-medium">
                    Tap to browse files or drag and drop 45° posterior pole retinal scan (.jpg, .png).
                  </p>
                </div>
                <div className="inline-block font-mono text-[11px] uppercase tracking-wider px-3.5 py-1 rounded-full bg-[var(--ink)] text-[var(--accent)] font-bold">
                  Automated OpenCV Quality Gate Triggered on Intake
                </div>
              </div>
            </div>

            {/* 5 Prototype Clinical Cases */}
            <div>
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-tight">
                    Or Test Demonstration Cases
                  </h2>
                  <p className="font-mono text-xs text-[var(--ink-soft)] mt-0.5">
                    Select a representative case with documented findings &amp; clinical severity:
                  </p>
                </div>
                <span className="font-mono text-xs uppercase font-bold text-[var(--ink)]">
                  5 CASload Ready
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {DEMO_CASES.map((c) => {
                  const isSelected = selectedCase.screeningId === c.screeningId;
                  return (
                    <div
                      key={c.screeningId}
                      onClick={() => {
                        sound.playClick(720);
                        selectCase(c);
                      }}
                      className={`p-5 rounded-2xl border-[2.5px] border-[var(--ink)] cursor-pointer transition-all flex flex-col justify-between select-none ${
                        isSelected
                          ? 'bg-[var(--ink)] text-[var(--accent)] shadow-[6px_6px_0_var(--ink)] scale-[1.01]'
                          : 'bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--accent)]/30 shadow-[3px_3px_0_var(--ink)]'
                      }`}
                      data-cursor-label="SELECT"
                    >
                      <div>
                        <div className="flex justify-between items-center font-mono text-[10px] uppercase font-bold mb-2">
                          <span>{c.demoNumber}</span>
                          <span className="underline">{c.drGradeLabel}</span>
                        </div>
                        <div className="font-bold text-sm mb-1">{c.title}</div>
                        <p className="text-[11px] opacity-80 line-clamp-2">{c.description}</p>
                      </div>

                      <div className="mt-4 pt-2 border-t border-current/20 flex items-center justify-between font-mono text-[10px]">
                        <span>Quality: {c.qualityStatus}</span>
                        <span className="font-bold">{c.confidenceValue}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Launch Button */}
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => handleStartScan()}
                  className="px-10 py-4 rounded-full bg-[var(--ink)] text-[var(--accent)] font-extrabold text-base tracking-tight shadow-[6px_6px_0_var(--ink)] hover:scale-105 active:scale-95 transition-all"
                  data-cursor-label="EXECUTE"
                >
                  Start Automated Inference Pipeline ({selectedCase.demoNumber}) →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── STAGE 2: PROCEDURAL SCANNING STATE ─── */}
      {screenState === 'scanning' && (
        <div className="py-16 text-center max-w-xl mx-auto space-y-8">
          <div className="w-20 h-20 rounded-full border-4 border-[var(--ink)] border-t-[var(--accent)] animate-spin mx-auto flex items-center justify-center">
            <Eye className="w-8 h-8 text-[var(--ink)]" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
              Executing Inference Pipeline
            </h2>
            <p className="font-mono text-xs text-[var(--ink-soft)] mt-1">
              Case: {selectedCase.patientAlias} · Model: EfficientNet-B0 + Grad-CAM
            </p>
          </div>

          <div className="p-6 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] shadow-[6px_6px_0_var(--ink)] space-y-3 text-left font-mono text-xs">
            {scanSequence.map((step, idx) => {
              const isDone = idx < scanStepIndex;
              const isCurrent = idx === scanStepIndex;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 transition-opacity ${
                    isDone
                      ? 'text-[var(--ok)] font-bold'
                      : isCurrent
                      ? 'text-[var(--ink)] font-bold animate-pulse'
                      : 'text-[var(--ink-mute)] opacity-40'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <span>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── STAGE 2.5: NON-RETINAL REJECTION INTERCEPT STATE ─── */}
      {screenState === 'rejected' && (
        <div className="py-10 max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="p-8 sm:p-12 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] shadow-[8px_8px_0_var(--ink)] text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500 text-white flex items-center justify-center mx-auto shadow-md">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-widest text-rose-600 mb-1 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Optical Quality Gate Intercept
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-[var(--ink)]">
                Non-Retinal Image Detected
              </h2>
            </div>

            <div className="p-5 rounded-2xl border-2 border-[var(--ink)] bg-[var(--bg)] text-left font-mono text-xs space-y-2.5 shadow-inner">
              <div className="font-bold text-[var(--ink)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Diagnostic Safety Intercept:
              </div>
              <p className="text-[var(--ink-soft)] leading-relaxed">
                {rejectionReason || 'The uploaded file does not exhibit optical reflectance or circular aperture features of a 45° posterior pole retinal photograph.'}
              </p>
            </div>

            <div className="text-xs text-[var(--ink-soft)] max-w-lg mx-auto text-left space-y-2">
              <div className="font-bold uppercase font-mono text-[11px] text-[var(--ink)]">
                Why this check is enforced:
              </div>
              <p className="leading-relaxed">
                RETINA-MITRA validates retinal chromaticity (foveal/choroidal red reflectance) and aperture geometry to prevent arbitrary non-medical images (selfies, landscapes, animals, or documents) from generating misleading or fabricated diabetic retinopathy results.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  sound.playClick(600);
                  fileInputRef.current?.click();
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-[var(--ink)] text-[var(--accent)] font-extrabold text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_0_var(--ink)] flex items-center justify-center gap-2 min-h-[44px]"
                data-cursor-label="UPLOAD"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Retinal Scan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick(600);
                  setScreenState('idle');
                  setRejectionReason(null);
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full border-2 border-[var(--ink)] bg-[var(--paper)] font-bold text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[3px_3px_0_var(--ink)] min-h-[44px]"
                data-cursor-label="BENCHMARK"
              >
                Select Benchmark Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STAGE 3: INTERACTIVE MULTI-LAYER RESULT WORKBENCH ─── */}
      {screenState === 'result' && (
        <div className="space-y-8">
          {/* Feedback Toast */}
          {reviewFeedback && (
            <div className="p-4 rounded-2xl bg-[var(--ok)] text-[var(--ink)] font-bold text-sm border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] animate-in fade-in slide-in-from-top-2">
              {reviewFeedback}
            </div>
          )}

          {/* Matched Verified Clinical Benchmark Banner */}
          {matchedBenchmarkInfo && (
            <div className="p-5 rounded-2xl border-2 border-[var(--ink)] bg-[var(--ok)]/20 text-[var(--ink)] shadow-[4px_4px_0_var(--ink)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Verified Benchmark Match Identified
                  </div>
                  <div className="font-bold text-sm text-[var(--ink)]">
                    {matchedBenchmarkInfo.caseTitle}
                  </div>
                  <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-0.5">
                    {matchedBenchmarkInfo.matchReason}
                  </div>
                </div>
              </div>
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[var(--ink)] text-[var(--accent)] shrink-0">
                {matchedBenchmarkInfo.demoNumber}
              </span>
            </div>
          )}

          {/* External Retinal Scan Completed Analysis Banner */}
          {selectedCase.code === 'RM-USR' && (
            <div className="p-5 rounded-3xl border-2 border-[var(--ink)] bg-[var(--paper)] shadow-[5px_5px_0_var(--ink)] space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[var(--ink)] text-[var(--accent)] shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[var(--ink)] flex flex-wrap items-center gap-2">
                    <span>Clinical Fundus Scan Analyzed</span>
                    <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--ok)] text-[var(--ink)] font-bold">
                      {selectedCase.qualityStatus}
                    </span>
                    <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--ink)] text-[var(--accent)] font-bold">
                      {selectedCase.drGradeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-soft)] mt-1 leading-relaxed">
                    Automated client-side lesion segmentation and optical quality analysis completed directly on your uploaded pixels. Real-time CLAHE, vascular tree, lesion bounding masks, and Grad-CAM attention heatmap are active across all 5 visual evidence layers below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Summary Header Card */}
          <div className="p-6 sm:p-8 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] shadow-[6px_6px_0_var(--ink)] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-[var(--ink-soft)] mb-1">
                PATIENT REF: {selectedCase.patientAlias} · {selectedCase.screeningId}
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-[var(--ink)]">
                {selectedCase.drGradeLabel}
              </h2>
              <p className="text-sm text-[var(--ink-soft)] font-medium mt-1 max-w-xl">
                {selectedCase.description}
              </p>
              {selectedCase.reviewDecision && (
                <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 border-[var(--ink)] font-mono text-xs font-bold shadow-[2px_2px_0_var(--ink)] bg-[var(--bg)] text-[var(--ink)]">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    selectedCase.reviewDecision.action === 'CONFIRMED'
                      ? 'bg-[var(--ok)]'
                      : selectedCase.reviewDecision.action === 'OVERRIDDEN'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`} />
                  <span>
                    Specialist Status: {selectedCase.reviewDecision.action === 'CONFIRMED' ? 'Confirmed & Signed Off' : selectedCase.reviewDecision.action === 'OVERRIDDEN' ? `Clinician Override (Grade ${selectedCase.drGrade})` : 'Recapture Requested / Ungradable'}
                  </span>
                  <span className="opacity-75">· {selectedCase.reviewDecision.reviewerId}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:gap-4 font-mono text-xs w-full sm:w-auto">
              <div className="p-3 rounded-2xl border-2 border-[var(--ink)] bg-[var(--bg)] text-center min-w-[110px]">
                <div className="font-extrabold text-xl">{selectedCase.confidenceValue}%</div>
                <div className="text-[10px] uppercase text-[var(--ink-soft)]">Confidence</div>
              </div>
              <div className="p-3 rounded-2xl border-2 border-[var(--ink)] bg-[var(--bg)] text-center min-w-[110px]">
                <div className={`font-extrabold text-xl ${selectedCase.qualityStatus === 'UNGRADABLE' ? 'text-rose-600' : 'text-[var(--ok)]'}`}>
                  {selectedCase.qualityStatus}
                </div>
                <div className="text-[10px] uppercase text-[var(--ink-soft)]">Quality Gate</div>
              </div>
            </div>
          </div>

          {/* Interactive Multi-Layer Canvas */}
          <CanvasImageViewer
            evidence={{
              rawImageUrl: selectedCase.rawImageUrl,
              enhancedImageUrl: selectedCase.enhancedImageUrl,
              vesselMapUrl: selectedCase.vesselMapUrl,
              gradcamUrl: selectedCase.gradcamUrl,
              lesionOverlayUrl: selectedCase.lesionOverlayUrl,
              combinedEvidenceUrl: selectedCase.combinedEvidenceUrl,
            }}
          />

          {/* Specialist HITL Actions & Clinical Export Bar */}
          <div className="p-6 sm:p-8 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] shadow-[6px_6px_0_var(--ink)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--ok)] animate-pulse" />
                  <h3 className="text-lg font-bold uppercase tracking-tight">
                    Specialist Decision Sign-off &amp; Audit Trail
                  </h3>
                </div>
                <p className="font-mono text-xs text-[var(--ink-soft)] mt-0.5">
                  Record ophthalmologist rationale before issuing official referral documents:
                </p>
              </div>

              {selectedCase.reviewDecision && (
                <div className={`self-start sm:self-auto px-3.5 py-1.5 rounded-full font-mono text-xs font-bold border-2 border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center gap-1.5 ${
                  selectedCase.reviewDecision.action === 'CONFIRMED'
                    ? 'bg-[var(--ok)] text-[var(--ink)]'
                    : selectedCase.reviewDecision.action === 'OVERRIDDEN'
                    ? 'bg-amber-400 text-[var(--ink)]'
                    : 'bg-rose-400 text-[var(--ink)]'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {selectedCase.reviewDecision.action === 'CONFIRMED' && '✓ SIGNED-OFF'}
                    {selectedCase.reviewDecision.action === 'OVERRIDDEN' && `⚠️ OVERRIDDEN (Grade ${selectedCase.drGrade})`}
                    {selectedCase.reviewDecision.action === 'UNGRADABLE' && '⛔ RETAKE FLAGGED'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <input
                type="text"
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                placeholder="Enter specialist clinical observation or override reasoning..."
                className="w-full px-4 py-3 rounded-xl border-2 border-[var(--ink)] bg-white text-slate-900 font-mono text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:bg-white shadow-[2px_2px_0_var(--ink)]"
              />

              {/* Quick Clinical Observation Tags */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink-mute)] mr-1">
                  Quick Clinical Tags:
                </span>
                {[
                  'FAZ margins intact',
                  'Microaneurysms detected in macula',
                  'Dot/blot hemorrhages >2 quadrants',
                  'Hard exudates within 1DD of fovea',
                  'Optical artifact overcalled',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      sound.playClick(600);
                      setReviewerNote((prev) => (prev ? `${prev}; ${tag}` : tag));
                    }}
                    className="px-2.5 py-1 rounded-full font-mono text-[10px] font-bold border border-[var(--ink)]/30 bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--paper)] transition-all shadow-sm"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Clinical Override Tray */}
            {isOverrideOpen && (
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-[var(--ink)] bg-[var(--bg)] shadow-[3px_3px_0_var(--ink)] space-y-3 animate-in fade-in duration-200">
                <div className="font-mono text-xs uppercase font-extrabold text-[var(--ink)] flex items-center justify-between">
                  <span>Select Clinician DR Grade Override:</span>
                  <span className="text-[10px] text-amber-800 font-bold">Overrides AI Classification</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { grade: 0, label: 'Grade 0: No DR' },
                    { grade: 1, label: 'Grade 1: Mild DR' },
                    { grade: 2, label: 'Grade 2: Moderate DR' },
                    { grade: 3, label: 'Grade 3: Severe DR' },
                    { grade: 4, label: 'Grade 4: PDR' },
                  ].map((item) => (
                    <button
                      key={item.grade}
                      type="button"
                      onClick={() => {
                        sound.playClick(750);
                        setOverrideGrade(item.grade);
                      }}
                      className={`p-2.5 rounded-xl border-2 font-mono text-[11px] font-bold text-center transition-all min-h-[40px] ${
                        overrideGrade === item.grade
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--accent)] shadow-[2px_2px_0_var(--ink)]'
                          : 'border-[var(--ink)]/40 bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--ink)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleReviewAction('OVERRIDDEN', 'Overridden Grade', overrideGrade)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full border-2 border-[var(--ink)] bg-amber-400 text-[var(--ink)] font-extrabold font-mono text-xs uppercase shadow-[2px_2px_0_var(--ink)] hover:scale-105 active:scale-95 transition-all min-h-[42px] text-center"
                  >
                    Confirm Override &amp; Apply
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2 border-t border-[var(--ink)]/20">
              <div className="grid grid-cols-3 sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleReviewAction('CONFIRMED', 'Confirmed Grade')}
                  className={`px-3 sm:px-4 py-2.5 rounded-full border-2 border-[var(--ink)] font-bold text-[11px] sm:text-xs uppercase hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0_var(--ink)] text-center min-h-[44px] flex items-center justify-center ${
                    selectedCase.reviewDecision?.action === 'CONFIRMED'
                      ? 'bg-[var(--ok)] text-[var(--ink)] ring-2 ring-[var(--ink)]'
                      : 'bg-[var(--ok)] text-[var(--ink)]'
                  }`}
                  data-cursor-label="CONFIRM"
                >
                  ✓ Sign-off
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick(700);
                    setIsOverrideOpen(!isOverrideOpen);
                  }}
                  className={`px-3 sm:px-4 py-2.5 rounded-full border-2 border-[var(--ink)] bg-amber-400 text-[var(--ink)] font-bold text-[11px] sm:text-xs uppercase hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0_var(--ink)] text-center min-h-[44px] flex items-center justify-center ${
                    isOverrideOpen ? 'ring-2 ring-[var(--ink)]' : ''
                  }`}
                  data-cursor-label="OVERRIDE"
                >
                  Override {isOverrideOpen ? '▲' : '▼'}
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction('UNGRADABLE', 'Flagged Ungradable')}
                  className="px-3 sm:px-4 py-2.5 rounded-full border-2 border-[var(--ink)] bg-rose-400 text-[var(--ink)] font-bold text-[11px] sm:text-xs uppercase hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0_var(--ink)] text-center min-h-[44px] flex items-center justify-center"
                  data-cursor-label="RETAKE"
                >
                  Retake
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--accent)] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_0_var(--ink)] min-h-[44px]"
                data-cursor-label="PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isDownloading ? 'Exporting...' : 'Export Referral PDF (English)'}</span>
              </button>
            </div>

            {/* Live Chronological Audit Trail */}
            <div className="pt-4 border-t-2 border-[var(--ink)]/15">
              <div
                onClick={() => setIsAuditTrailExpanded(!isAuditTrailExpanded)}
                className="flex items-center justify-between cursor-pointer select-none py-1 text-[var(--ink)] hover:text-[var(--ink-soft)] transition-colors"
              >
                <div className="font-mono text-xs font-bold uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--ink)]" />
                  <span>Chronological Audit Trail ({selectedCase.auditTrail?.length || 0} Events)</span>
                </div>
                <span className="font-mono text-xs font-bold">
                  {isAuditTrailExpanded ? 'Hide ▲' : 'Show ▼'}
                </span>
              </div>

              {isAuditTrailExpanded && (
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedCase.auditTrail && selectedCase.auditTrail.length > 0 ? (
                    selectedCase.auditTrail.map((event, idx) => (
                      <div
                        key={event.id || idx}
                        className="p-3 rounded-xl border-2 border-[var(--ink)]/25 bg-white text-slate-900 font-mono text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-[1px_1px_0_var(--ink)]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                              event.actorRole === 'reviewer'
                                ? 'bg-amber-100 text-amber-900 border-amber-400'
                                : event.actorRole === 'operator'
                                ? 'bg-blue-100 text-blue-900 border-blue-400'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {event.actorId}
                          </span>
                          <span className="font-bold text-[var(--ink)]">
                            [{event.action}]
                          </span>
                          <span className="text-slate-700 font-medium">
                            {event.details}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--ink-mute)] whitespace-nowrap shrink-0">
                          {new Date(event.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-[var(--ink)]/30 text-center font-mono text-xs text-[var(--ink-soft)]">
                      No audit events recorded yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Essential Patient Clinical Details Intake Modal */}
      <PatientDetailsModal
        isOpen={isPatientModalOpen}
        patientAlias={selectedCase.patientAlias}
        screeningId={selectedCase.screeningId}
        onClose={() => setIsPatientModalOpen(false)}
        onSubmit={handleConfirmPatientDetails}
        isDownloading={isDownloading}
      />
    </div>
  );
}

export default function ScreeningNewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center font-mono text-sm uppercase">
          Loading Intake Portal...
        </div>
      }
    >
      <ScreeningInner />
    </Suspense>
  );
}
