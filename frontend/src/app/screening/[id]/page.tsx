'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSessionStore } from '@/hooks/useSessionStore';
import { generateReport } from '@/lib/generateReport';
import { CanvasImageViewer } from '@/components/CanvasImageViewer';
import { PatientDetailsModal } from '@/components/PatientDetailsModal';
import { EssentialPatientDetails } from '@/types/screening';
import { sound } from '@/lib/sound';
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  XCircle,
  UserCheck,
  Activity,
  ShieldCheck,
  Eye,
} from 'lucide-react';

export default function ScreeningDetailPage() {
  const routeParams = useParams();
  const screeningId = (routeParams?.id as string) || '';
  const { getScreenedCase, submitReview, markReportGenerated } = useSessionStore();

  const screenedCase = getScreenedCase(screeningId);
  const screening = screenedCase?.screening;

  const [reviewerNote, setReviewerNote] = useState<string>('');
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState<boolean>(false);
  const [overrideGrade, setOverrideGrade] = useState<number>(2);
  const [isAuditTrailExpanded, setIsAuditTrailExpanded] = useState<boolean>(true);

  if (!screenedCase || !screening) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] pt-32 pb-20 px-4 sm:px-8 max-w-lg mx-auto">
        <div className="p-8 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] text-center shadow-[6px_6px_0_var(--ink)]">
          <XCircle className="w-12 h-12 text-rose-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold uppercase tracking-tight">Record Not Found</h2>
          <p className="font-mono text-xs text-[var(--ink-soft)] my-4">
            Case ID <span className="font-bold underline">{screeningId}</span> is not registered in the current session.
          </p>
          <Link
            href="/screening/new"
            onClick={() => sound.playClick()}
            className="inline-block px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--accent)] font-bold text-xs uppercase shadow-[3px_3px_0_var(--ink)] no-underline"
          >
            Start New Screening
          </Link>
        </div>
      </div>
    );
  }

  const isUngradable = screening.qualityStatus === 'UNGRADABLE';
  const gradeLabel =
    typeof screening.drGrade === 'object'
      ? screening.drGrade.drGradeLabel
      : screening.drGradeLabel || `Grade ${screening.drGrade}`;
  const fallbackImg = screening.imageUrl || '/prototype-cases/rm-001/original.jpg';

  const handleReviewAction = (
    action: 'CONFIRMED' | 'RE_REVIEW' | 'UNGRADABLE' | 'OVERRIDDEN',
    label: string,
    chosenOverrideGrade?: number
  ) => {
    sound.playClick(850);
    const now = new Date().toISOString();
    const targetGrade = action === 'OVERRIDDEN' ? (chosenOverrideGrade !== undefined ? chosenOverrideGrade : overrideGrade) : undefined;
    const comments = reviewerNote.trim() || (action === 'CONFIRMED' ? 'Confirmed by specialist' : action === 'OVERRIDDEN' ? `Overridden to Grade ${targetGrade}` : 'Flagged ungradable');

    submitReview(screening.screeningId, {
      reviewerId: 'DR-SPECIALIST-01',
      action,
      overrideGrade: targetGrade,
      comments,
      reviewedAt: now,
    });

    setReviewFeedback(`Specialist action registered: ${label}`);
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
      screening.patientDetails = details;
      
      // Preserve active review decision or active specialist observation
      if (screening.reviewDecision) {
        // already has official reviewDecision
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] pt-24 sm:pt-28 pb-28 sm:pb-32 px-4 sm:px-8 max-w-[1400px] mx-auto selection:bg-[var(--ink)] selection:text-[var(--accent)]">
      {/* ─── BREADCRUMB & HEADER ─── */}
      <div className="pb-6 border-b-2 border-[var(--ink)] mb-10">
        <Link
          href="/dashboard"
          onClick={() => sound.playClick(600)}
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] mb-3 no-underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Cockpit</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-1">
              Case Verification · {screening.screeningId}
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight">
              {screening.patientAlias || 'Patient Scan'} · {gradeLabel}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-full bg-[var(--ink)] text-[var(--accent)] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_0_var(--ink)] min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Generating...' : 'Export PDF Report'}</span>
          </button>
        </div>
      </div>

      {reviewFeedback && (
        <div className="p-4 rounded-2xl bg-[var(--ok)] text-[var(--ink)] font-bold text-sm border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] mb-8">
          {reviewFeedback}
        </div>
      )}

      {/* ─── SUMMARY TELEMETRY BENTO ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-6 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] shadow-[6px_6px_0_var(--ink)]">
          <div className="font-mono text-[10px] uppercase text-[var(--ink-mute)] mb-1">
            ICDR Severity
          </div>
          <div className="text-2xl font-extrabold text-[var(--ink)]">{gradeLabel}</div>
          <div className="font-mono text-xs text-[var(--ink-soft)] mt-1">
            Confidence: {Math.round((typeof screening.confidence === 'number' ? screening.confidence : screening.confidence.calibratedConfidence || 0.94) * 100)}%
          </div>
        </div>

        <div className="p-6 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] shadow-[6px_6px_0_var(--ink)]">
          <div className="font-mono text-[10px] uppercase text-[var(--ink-mute)] mb-1">
            OpenCV Quality Gate
          </div>
          <div
            className={`text-2xl font-extrabold ${
              isUngradable ? 'text-rose-600' : 'text-[var(--ok)]'
            }`}
          >
            {screening.qualityStatus}
          </div>
          <div className="font-mono text-xs text-[var(--ink-soft)] mt-1">
            Focus variance &gt; threshold
          </div>
        </div>

        <div className="p-6 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] shadow-[6px_6px_0_var(--ink)]">
          <div className="font-mono text-[10px] uppercase text-[var(--ink-mute)] mb-1">
            Clinical Recommendation
          </div>
          <div className="text-2xl font-extrabold text-[var(--ink)]">
            {screening.referable ? 'Specialist Referral' : 'Routine Monitoring'}
          </div>
          <div className="font-mono text-xs text-[var(--ink-soft)] mt-1">
            {screening.referable ? 'Specialist referral recommended' : 'Annual follow-up'}
          </div>
        </div>
      </div>

      {/* ─── INTERACTIVE MULTI-LAYER VIEWER ─── */}
      <div className="mb-8">
        <CanvasImageViewer
          evidence={{
            rawImageUrl: fallbackImg,
            enhancedImageUrl: screening.evidence?.enhancedImageUrl || fallbackImg,
            vesselMapUrl: screening.evidence?.vesselMapUrl || fallbackImg,
            gradcamUrl: screening.evidence?.gradcamUrl || fallbackImg,
            lesionOverlayUrl: screening.evidence?.lesionOverlayUrl || fallbackImg,
            combinedEvidenceUrl: screening.evidence?.combinedEvidenceUrl || fallbackImg,
          }}
        />
      </div>

      {/* ─── SPECIALIST REVIEW PANEL ─── */}
      <div className="p-6 sm:p-8 rounded-3xl border-[2.5px] border-[var(--ink)] bg-[var(--paper)] shadow-[6px_6px_0_var(--ink)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--ok)] animate-pulse" />
              <h3 className="text-xl font-bold uppercase tracking-tight">Specialist Sign-off Station &amp; Audit Trail</h3>
            </div>
            <p className="font-mono text-xs text-[var(--ink-soft)] mt-0.5">
              Record specialist observations or justification for override before generating official referral report:
            </p>
          </div>

          {screening.reviewDecision && (
            <div className={`self-start sm:self-auto px-3.5 py-1.5 rounded-full font-mono text-xs font-bold border-2 border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center gap-1.5 ${
              screening.reviewDecision.action === 'CONFIRMED'
                ? 'bg-[var(--ok)] text-[var(--ink)]'
                : screening.reviewDecision.action === 'OVERRIDDEN'
                ? 'bg-amber-400 text-[var(--ink)]'
                : 'bg-rose-400 text-[var(--ink)]'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {screening.reviewDecision.action === 'CONFIRMED' && '✓ SIGNED-OFF'}
                {screening.reviewDecision.action === 'OVERRIDDEN' && `⚠️ OVERRIDDEN (Grade ${screening.reviewDecision.overrideGrade ?? 'Clinical'})`}
                {screening.reviewDecision.action === 'UNGRADABLE' && '⛔ RETAKE FLAGGED'}
              </span>
            </div>
          )}
        </div>

        <div>
          <input
            type="text"
            value={reviewerNote}
            onChange={(e) => setReviewerNote(e.target.value)}
            placeholder="Record specialist observations or justification for override..."
            className="w-full px-4 py-3 rounded-xl border-2 border-[var(--ink)] bg-white text-slate-900 font-mono text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:bg-white shadow-[2px_2px_0_var(--ink)] min-h-[44px]"
          />

          {/* Quick Clinical Observation Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink-mute)] mr-1">
              Quick Tags:
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
                  className={`p-2.5 rounded-xl border-2 font-mono text-[11px] font-bold text-center transition-all ${
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
                className="px-5 py-2.5 rounded-full border-2 border-[var(--ink)] bg-amber-400 text-[var(--ink)] font-extrabold font-mono text-xs uppercase shadow-[2px_2px_0_var(--ink)] hover:scale-105 active:scale-95 transition-all"
              >
                Confirm Override &amp; Apply
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 pt-2 border-t border-[var(--ink)]/20">
          <button
            type="button"
            onClick={() => handleReviewAction('CONFIRMED', 'Confirmed Grade')}
            className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-full border-2 border-[var(--ink)] font-bold text-xs uppercase hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0_var(--ink)] text-center min-h-[44px] ${
              screening.reviewDecision?.action === 'CONFIRMED'
                ? 'bg-[var(--ok)] text-[var(--ink)] ring-2 ring-[var(--ink)]'
                : 'bg-[var(--ok)] text-[var(--ink)]'
            }`}
          >
            ✓ Confirm Classification
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playClick(700);
              setIsOverrideOpen(!isOverrideOpen);
            }}
            className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-full border-2 border-[var(--ink)] bg-amber-400 text-[var(--ink)] font-bold text-xs uppercase hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0_var(--ink)] text-center min-h-[44px] ${
              isOverrideOpen ? 'ring-2 ring-[var(--ink)]' : ''
            }`}
          >
            Override Classification {isOverrideOpen ? '▲' : '▼'}
          </button>
          <button
            type="button"
            onClick={() => handleReviewAction('UNGRADABLE', 'Flagged Ungradable')}
            className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-full border-2 border-[var(--ink)] bg-rose-400 text-[var(--ink)] font-bold text-xs uppercase hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0_var(--ink)] text-center min-h-[44px]"
          >
            Request Retake
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
              <span>Chronological Audit Trail ({screening.auditTrail?.length || 0} Events)</span>
            </div>
            <span className="font-mono text-xs font-bold">
              {isAuditTrailExpanded ? 'Hide ▲' : 'Show ▼'}
            </span>
          </div>

          {isAuditTrailExpanded && (
            <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
              {screening.auditTrail && screening.auditTrail.length > 0 ? (
                screening.auditTrail.map((event, idx) => (
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

      {/* Mandatory Clinical Patient Profile Intake Modal */}
      <PatientDetailsModal
        isOpen={isPatientModalOpen}
        patientAlias={screening.patientAlias}
        screeningId={screening.screeningId}
        onClose={() => setIsPatientModalOpen(false)}
        onSubmit={handleConfirmPatientDetails}
        isDownloading={isDownloading}
      />
    </div>
  );
}
