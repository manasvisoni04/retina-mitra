'use client';

import React, { useState, useEffect } from 'react';
import { EssentialPatientDetails } from '@/types/screening';
import { sound } from '@/lib/sound';
import {
  FileText,
  X,
  AlertCircle,
  Activity,
  HeartPulse,
  Eye,
  Pill,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface PatientDetailsModalProps {
  isOpen: boolean;
  patientAlias: string;
  screeningId: string;
  onClose: () => void;
  onSubmit: (details: EssentialPatientDetails) => void;
  isDownloading: boolean;
}

export function PatientDetailsModal({
  isOpen,
  patientAlias,
  screeningId,
  onClose,
  onSubmit,
  isDownloading,
}: PatientDetailsModalProps) {
  // Form State — Starts completely empty until filled by user
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<'' | 'Male' | 'Female' | 'Other'>('');
  const [pregnancyStatus, setPregnancyStatus] = useState<'' | EssentialPatientDetails['pregnancyStatus']>('');
  const [diabetesType, setDiabetesType] = useState<'' | EssentialPatientDetails['diabetesType']>('');
  const [diabetesDurationYears, setDiabetesDurationYears] = useState<string>('');
  const [latestHbA1c, setLatestHbA1c] = useState<string>('');
  const [recentBloodGlucose, setRecentBloodGlucose] = useState<string>('');
  const [insulinUse, setInsulinUse] = useState<boolean>(false);
  const [currentMedications, setCurrentMedications] = useState<string>('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedEyeHistory, setSelectedEyeHistory] = useState<string[]>([]);
  const [selectedSystemic, setSelectedSystemic] = useState<string[]>([]);

  // Validation Tracking
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  // Lock background scrolling when modal is open to prevent dual-scroll confusion
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSymptom = (symptom: string) => {
    sound.playClick(650);
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy.symptoms;
      return copy;
    });

    if (symptom === 'None (Asymptomatic)') {
      setSelectedSymptoms(['None (Asymptomatic)']);
      return;
    }
    const filtered = selectedSymptoms.filter((s) => s !== 'None (Asymptomatic)');
    if (filtered.includes(symptom)) {
      setSelectedSymptoms(filtered.filter((s) => s !== symptom));
    } else {
      setSelectedSymptoms([...filtered, symptom]);
    }
  };

  const toggleEyeHistory = (item: string) => {
    sound.playClick(650);
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy.eyeHistory;
      return copy;
    });

    if (item === 'None / No Prior Eye Surgeries') {
      setSelectedEyeHistory(['None / No Prior Eye Surgeries']);
      return;
    }
    const filtered = selectedEyeHistory.filter((s) => s !== 'None / No Prior Eye Surgeries');
    if (filtered.includes(item)) {
      setSelectedEyeHistory(filtered.filter((s) => s !== item));
    } else {
      setSelectedEyeHistory([...filtered, item]);
    }
  };

  const toggleSystemic = (item: string) => {
    sound.playClick(650);
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy.systemic;
      return copy;
    });

    if (item === 'None') {
      setSelectedSystemic(['None']);
      return;
    }
    const filtered = selectedSystemic.filter((s) => s !== 'None');
    if (filtered.includes(item)) {
      setSelectedSystemic(filtered.filter((s) => s !== item));
    } else {
      setSelectedSystemic([...filtered, item]);
    }
  };

  const validateAll = (): boolean => {
    const errors: Record<string, string> = {};

    if (!patientAge.trim()) {
      errors.age = 'Patient age is mandatory.';
    } else if (isNaN(Number(patientAge)) || Number(patientAge) <= 0 || Number(patientAge) > 120) {
      errors.age = 'Enter a valid age (1-120 years).';
    }

    if (!patientGender) {
      errors.gender = 'Biological sex selection is mandatory.';
    }

    if (patientGender === 'Female' && !pregnancyStatus) {
      errors.pregnancy = 'Pregnancy status is mandatory for female patients.';
    }

    if (!diabetesType) {
      errors.diabetesType = 'Diabetes classification is mandatory.';
    }

    if (!diabetesDurationYears.trim()) {
      errors.duration = 'Duration of diabetes is mandatory.';
    } else if (isNaN(Number(diabetesDurationYears)) || Number(diabetesDurationYears) < 0) {
      errors.duration = 'Enter a valid non-negative number of years.';
    }

    if (!latestHbA1c.trim()) {
      errors.hba1c = 'Latest HbA1c reading is mandatory.';
    }

    if (!recentBloodGlucose.trim()) {
      errors.glucose = 'Recent blood glucose value is mandatory.';
    }

    if (!currentMedications.trim()) {
      errors.medications = 'Current medications list is mandatory (or write "None").';
    }

    if (selectedSymptoms.length === 0) {
      errors.symptoms = 'Select at least one symptom option (or "None (Asymptomatic)").';
    }

    if (selectedEyeHistory.length === 0) {
      errors.eyeHistory = 'Select at least one eye history option (or "None / No Prior Eye Surgeries").';
    }

    if (selectedSystemic.length === 0) {
      errors.systemic = 'Select at least one systemic condition option (or "None").';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick(900);
    setAttemptedSubmit(true);

    if (!validateAll()) {
      sound.playClick(300);
      return;
    }

    const resolvedPregnancy =
      patientGender === 'Male'
        ? 'Not Applicable (Male)'
        : pregnancyStatus || 'Not Pregnant';

    const details: EssentialPatientDetails = {
      patientAge: patientAge.trim(),
      patientGender: patientGender as 'Male' | 'Female' | 'Other',
      pregnancyStatus: resolvedPregnancy,
      diabetesType: diabetesType as EssentialPatientDetails['diabetesType'],
      diabetesDurationYears: diabetesDurationYears.trim(),
      latestHbA1c: latestHbA1c.includes('%') ? latestHbA1c.trim() : `${latestHbA1c.trim()}%`,
      recentBloodGlucose: recentBloodGlucose.includes('mg/dL')
        ? recentBloodGlucose.trim()
        : `${recentBloodGlucose.trim()} mg/dL`,
      currentMedications: currentMedications.trim(),
      insulinUse,
      ocularSymptoms: selectedSymptoms,
      eyeHistory: selectedEyeHistory,
      systemicConditions: selectedSystemic,
    };

    onSubmit(details);
  };

  // High-contrast, clean white input style with dark legible text — NO blackening
  const inputBaseStyle =
    'w-full px-3.5 py-2.5 rounded-xl border-2 border-[var(--ink)] bg-white text-slate-900 font-mono text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:bg-white shadow-[2px_2px_0_var(--ink)] transition-all';

  const scrollToSection = (secId: string) => {
    sound.playClick(600);
    const el = document.getElementById(secId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-[94vh] max-h-[840px] flex flex-col bg-[var(--paper)] text-[var(--ink)] border-[2.5px] border-[var(--ink)] rounded-3xl shadow-[8px_8px_0_var(--ink)] overflow-hidden">
        {/* Header - Fixed & High Contrast */}
        <div className="shrink-0 p-4 sm:p-5 border-b-2 border-[var(--ink)] flex items-start justify-between bg-[var(--bg)] gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--ink)]/40 bg-[var(--paper)] font-mono text-[10px] uppercase tracking-wider text-[var(--ink)] font-bold mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--ok)]" />
              <span>Mandatory Clinical Intake · Tele-Ophthalmology</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-[var(--ink)]">
              Essential Clinical Patient Profile
            </h2>
            <p className="text-xs text-[var(--ink-soft)] mt-0.5">
              Ref: <span className="font-bold underline text-[var(--ink)]">{patientAlias}</span> ({screeningId})
              <span className="block sm:inline sm:ml-2 text-rose-600 font-bold">
                * All 7 clinical fields mandatory prior to referral PDF
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playClick(500);
              onClose();
            }}
            className="p-2 rounded-full border-2 border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0_var(--ink)] shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Quick-Jump Bar — Makes scrolling effortless */}
        <div className="shrink-0 px-3 py-2 border-b-2 border-[var(--ink)]/20 bg-slate-100/90 flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-[10px] font-bold select-none">
          <span className="text-slate-500 uppercase shrink-0 mr-0.5">Jump:</span>
          {[
            { id: 'sec-demographics', label: '1. Demographics' },
            { id: 'sec-diabetes', label: '2. Diabetes' },
            { id: 'sec-glucose', label: '3. Glucose' },
            { id: 'sec-medications', label: '4. Medications' },
            { id: 'sec-symptoms', label: '5. Symptoms' },
            { id: 'sec-eye-history', label: '6. Eye History' },
            { id: 'sec-systemic', label: '7. Systemic' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => scrollToSection(tab.id)}
              className="px-2.5 py-1 rounded-full border border-[var(--ink)]/30 bg-white text-slate-800 hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--accent)] transition-all shrink-0 shadow-xs"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Form Body — Smooth natural scrolling with no trap */}
        <form
          id="patient-details-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6 scroll-smooth pb-16"
          style={{ scrollbarWidth: 'thin' }}
        >
          {/* Actionable Error Banner if validation fails */}
          {attemptedSubmit && Object.keys(validationErrors).length > 0 && (
            <div className="p-4 rounded-2xl border-2 border-rose-500 bg-rose-50 text-rose-800 font-mono text-xs flex items-start gap-3 shadow-[3px_3px_0_#ef4444]">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold uppercase tracking-wide">Incomplete Patient Profile:</div>
                <div className="mt-1 text-[11px] leading-relaxed">
                  Please fill all mandatory sections highlighted in red below before downloading the clinical referral documentation.
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Demographics */}
          <div id="sec-demographics" className="scroll-mt-4">
            <div className="font-mono text-xs font-bold uppercase text-[var(--ink-mute)] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[var(--ink)]" />
                <span>1. Demographics &amp; Identifiers</span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold">* Mandatory</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-[var(--ink-soft)] mb-1">
                  Age (Years) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={patientAge}
                  onChange={(e) => {
                    setPatientAge(e.target.value);
                    if (validationErrors.age) {
                      setValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.age;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputBaseStyle} ${
                    validationErrors.age ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  placeholder="Format: Age in years, e.g. 54"
                />
                {validationErrors.age && (
                  <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.age}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-[var(--ink-soft)] mb-1">
                  Biological Sex <span className="text-rose-600">*</span>
                </label>
                <select
                  value={patientGender}
                  onChange={(e) => {
                    const val = e.target.value as 'Male' | 'Female' | 'Other';
                    setPatientGender(val);
                    if (val === 'Male') {
                      setPregnancyStatus('Not Applicable (Male)');
                    } else if (pregnancyStatus === 'Not Applicable (Male)') {
                      setPregnancyStatus('');
                    }
                    if (validationErrors.gender) {
                      setValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.gender;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputBaseStyle} ${
                    validationErrors.gender ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                >
                  <option value="" disabled>
                    -- Select Biological Sex --
                  </option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
                {validationErrors.gender && (
                  <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.gender}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-[var(--ink-soft)] mb-1">
                  Pregnancy Status {patientGender === 'Female' && <span className="text-rose-600">*</span>}
                </label>
                <select
                  disabled={patientGender === 'Male'}
                  value={patientGender === 'Male' ? 'Not Applicable (Male)' : pregnancyStatus}
                  onChange={(e) => {
                    setPregnancyStatus(e.target.value as EssentialPatientDetails['pregnancyStatus']);
                    if (validationErrors.pregnancy) {
                      setValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.pregnancy;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputBaseStyle} ${
                    patientGender === 'Male' ? 'opacity-60 cursor-not-allowed bg-slate-100 text-slate-500' : ''
                  } ${validationErrors.pregnancy ? 'border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                >
                  <option value="" disabled>
                    -- Select Pregnancy Status --
                  </option>
                  <option value="Not Pregnant">Not Pregnant</option>
                  <option value="Currently Pregnant">Currently Pregnant (Accelerated DR Risk)</option>
                  <option value="Not Applicable (Male)">Not Applicable</option>
                </select>
                {validationErrors.pregnancy && (
                  <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.pregnancy}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Type and Duration of Diabetes */}
          <div id="sec-diabetes" className="pt-3 border-t border-[var(--ink)]/15 scroll-mt-4">
            <div className="font-mono text-xs font-bold uppercase text-[var(--ink-mute)] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--ink)]" />
                <span>2. Type and Duration of Diabetes</span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold">* Mandatory</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-[var(--ink-soft)] mb-1">
                  Diabetes Classification <span className="text-rose-600">*</span>
                </label>
                <select
                  value={diabetesType}
                  onChange={(e) => {
                    setDiabetesType(e.target.value as EssentialPatientDetails['diabetesType']);
                    if (validationErrors.diabetesType) {
                      setValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.diabetesType;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputBaseStyle} ${
                    validationErrors.diabetesType ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                >
                  <option value="" disabled>
                    -- Select Diabetes Classification --
                  </option>
                  <option value="Type 2 Diabetes">Type 2 Diabetes (Adult-Onset)</option>
                  <option value="Type 1 Diabetes">Type 1 Diabetes (Insulin-Dependent)</option>
                  <option value="Gestational Diabetes">Gestational Diabetes Mellitus</option>
                  <option value="Pre-diabetes">Pre-diabetes / Impaired Fasting Glucose</option>
                </select>
                {validationErrors.diabetesType && (
                  <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.diabetesType}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-[var(--ink-soft)] mb-1">
                  Known Duration (Years) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={diabetesDurationYears}
                  onChange={(e) => {
                    setDiabetesDurationYears(e.target.value);
                    if (validationErrors.duration) {
                      setValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.duration;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputBaseStyle} ${
                    validationErrors.duration ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  placeholder="Format: Number of years, e.g. 7 or 0.5"
                />
                {validationErrors.duration && (
                  <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.duration}</p>
                )}
              </div>
            </div>
            <p className="font-mono text-[10px] text-[var(--ink-soft)] mt-1.5">
              *Longer diabetes duration directly correlates with baseline risk for retinal microvascular damage.
            </p>
          </div>

          {/* Section 3: Blood Sugar Control Levels */}
          <div id="sec-glucose" className="pt-3 border-t border-[var(--ink)]/15 scroll-mt-4">
            <div className="font-mono text-xs font-bold uppercase text-[var(--ink-mute)] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-[var(--ink)]" />
                <span>3. Blood Sugar Control Levels</span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold">* Mandatory</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-[var(--ink-soft)] mb-1">
                  Latest HbA1c Reading (%) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={latestHbA1c}
                  onChange={(e) => {
                    setLatestHbA1c(e.target.value);
                    if (validationErrors.hba1c) {
                      setValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.hba1c;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputBaseStyle} ${
                    validationErrors.hba1c ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  placeholder="Format: HbA1c %, e.g. 7.6% (or 7.6)"
                />
                {validationErrors.hba1c && (
                  <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.hba1c}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-[var(--ink-soft)] mb-1">
                  Recent Blood Glucose (mg/dL) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={recentBloodGlucose}
                  onChange={(e) => {
                    setRecentBloodGlucose(e.target.value);
                    if (validationErrors.glucose) {
                      setValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.glucose;
                        return copy;
                      });
                    }
                  }}
                  className={`${inputBaseStyle} ${
                    validationErrors.glucose ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  placeholder="Format: mg/dL, e.g. 158 mg/dL (or 158)"
                />
                {validationErrors.glucose && (
                  <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.glucose}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Current Medications & Insulin */}
          <div id="sec-medications" className="pt-3 border-t border-[var(--ink)]/15 scroll-mt-4">
            <div className="font-mono text-xs font-bold uppercase text-[var(--ink-mute)] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-[var(--ink)]" />
                <span>4. Current Diabetes Medications</span>
              </span>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-white px-2.5 py-1 rounded-full border-2 border-[var(--ink)] shadow-[1px_1px_0_var(--ink)]">
                <span className="text-[10px] text-slate-900 font-bold">Active Insulin Use:</span>
                <input
                  type="checkbox"
                  checked={insulinUse}
                  onChange={(e) => {
                    sound.playClick(600);
                    setInsulinUse(e.target.checked);
                  }}
                  className="w-4 h-4 rounded border-2 border-[var(--ink)] text-[var(--ink)] accent-[var(--ink)]"
                />
              </label>
            </div>
            <textarea
              rows={2}
              value={currentMedications}
              onChange={(e) => {
                setCurrentMedications(e.target.value);
                if (validationErrors.medications) {
                  setValidationErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.medications;
                    return copy;
                  });
                }
              }}
              className={`${inputBaseStyle} ${
                validationErrors.medications ? 'border-rose-500 ring-2 ring-rose-500/20' : ''
              }`}
              placeholder="Format: List drug names &amp; dosage, e.g. Metformin 500mg BD, Glimepiride 1mg OD (or write 'None' if unmedicated)"
            />
            {validationErrors.medications && (
              <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.medications}</p>
            )}
          </div>

          {/* Section 5: Ocular and Vision Symptoms */}
          <div id="sec-symptoms" className="pt-3 border-t border-[var(--ink)]/15 scroll-mt-4">
            <div className="font-mono text-xs font-bold uppercase text-[var(--ink-mute)] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[var(--ink)]" />
                <span>5. Ocular and Vision Symptoms</span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold">* Select at least 1</span>
            </div>
            <div
              className={`p-3 rounded-2xl border-2 transition-all ${
                validationErrors.symptoms
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-[var(--ink)]/30 bg-white shadow-[2px_2px_0_var(--ink)]'
              }`}
            >
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Blurred Vision',
                  'Fluctuating Sight',
                  'Intermittent Floaters',
                  'Dark Spots / Scotoma',
                  'Impaired Night Vision',
                  'None (Asymptomatic)',
                ].map((sym) => {
                  const isSelected = selectedSymptoms.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymptom(sym)}
                      className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-bold transition-all border-2 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-[var(--accent)] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                          : 'bg-slate-100 text-slate-800 border-slate-300 hover:border-[var(--ink)] hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {sym}
                    </button>
                  );
                })}
              </div>
            </div>
            {validationErrors.symptoms && (
              <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.symptoms}</p>
            )}
          </div>

          {/* Section 6: History of Eye Conditions or Surgeries */}
          <div id="sec-eye-history" className="pt-3 border-t border-[var(--ink)]/15 scroll-mt-4">
            <div className="font-mono text-xs font-bold uppercase text-[var(--ink-mute)] mb-2 flex items-center justify-between">
              <span>6. History of Eye Conditions or Surgeries</span>
              <span className="text-[10px] text-rose-600 font-bold">* Select at least 1</span>
            </div>
            <div
              className={`p-3 rounded-2xl border-2 transition-all ${
                validationErrors.eyeHistory
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-[var(--ink)]/30 bg-white shadow-[2px_2px_0_var(--ink)]'
              }`}
            >
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Cataract Surgery',
                  'Glaucoma',
                  'Laser Photocoagulation',
                  'Anti-VEGF Injections',
                  'Prior Vitrectomy',
                  'None / No Prior Eye Surgeries',
                ].map((item) => {
                  const isSelected = selectedEyeHistory.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleEyeHistory(item)}
                      className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-bold transition-all border-2 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-[var(--accent)] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                          : 'bg-slate-100 text-slate-800 border-slate-300 hover:border-[var(--ink)] hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
            {validationErrors.eyeHistory && (
              <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.eyeHistory}</p>
            )}
          </div>

          {/* Section 7: Co-existing Systemic Conditions */}
          <div id="sec-systemic" className="pt-3 border-t border-[var(--ink)]/15 scroll-mt-4">
            <div className="font-mono text-xs font-bold uppercase text-[var(--ink-mute)] mb-2 flex items-center justify-between">
              <span>7. Co-existing Systemic Conditions</span>
              <span className="text-[10px] text-rose-600 font-bold">* Select at least 1</span>
            </div>
            <div
              className={`p-3 rounded-2xl border-2 transition-all ${
                validationErrors.systemic
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-[var(--ink)]/30 bg-white shadow-[2px_2px_0_var(--ink)]'
              }`}
            >
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Hypertension (High BP)',
                  'Hyperlipidemia (High Cholesterol)',
                  'Diabetic Kidney Disease (Nephropathy)',
                  'Cardiovascular Disease',
                  'None',
                ].map((cond) => {
                  const isSelected = selectedSystemic.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleSystemic(cond)}
                      className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-bold transition-all border-2 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-[var(--accent)] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                          : 'bg-slate-100 text-slate-800 border-slate-300 hover:border-[var(--ink)] hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>
            {validationErrors.systemic && (
              <p className="font-mono text-[10px] text-rose-600 font-bold mt-1">{validationErrors.systemic}</p>
            )}
          </div>
        </form>

        {/* Footer Actions — Fixed at bottom of modal */}
        <div className="shrink-0 p-4 sm:p-5 border-t-2 border-[var(--ink)] bg-[var(--bg)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              sound.playClick(500);
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full border-2 border-[var(--ink)] bg-[var(--paper)] font-bold text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0_var(--ink)]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isDownloading}
            className="w-full sm:w-auto px-7 py-3 rounded-full bg-[var(--ink)] text-[var(--accent)] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_0_var(--ink)]"
          >
            <FileText className="w-4 h-4" />
            <span>{isDownloading ? 'Generating Clinical PDF...' : 'Attach Profile & Download Referral PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
