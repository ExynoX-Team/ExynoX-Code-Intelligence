import { useState } from 'react';
import { 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import type { InvestigationEvent, InvestigationState } from '../../types/agent.js';
import type { LLMProviderErrorInfo } from '../../types/llm.js';

interface InvestigationPanelProps {
  investigation?: InvestigationState | null;
  events?: InvestigationEvent[];
  isLive?: boolean;
  providerError?: LLMProviderErrorInfo | null;
}

const DEFAULT_FLOW_STEPS: { type: InvestigationEvent['type']; label: string }[] = [
  { type: 'UNDERSTANDING', label: 'Understanding question' },
  { type: 'PLANNING', label: 'Creating investigation plan' },
  { type: 'SEARCHING', label: 'Searching repository' },
  { type: 'INSPECTING', label: 'Inspecting candidates' },
  { type: 'FOLLOWING', label: 'Following references' },
  { type: 'VERIFYING', label: 'Verifying evidence' }
];

export function InvestigationPanel({
  investigation,
  events: propEvents,
  isLive = false,
  providerError
}: InvestigationPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Derive events list either from props, investigation, or default initial flow
  const rawEvents = propEvents || investigation?.events;

  // Build merged display steps so the user sees the canonical progression
  const displaySteps = DEFAULT_FLOW_STEPS.map((stepDef) => {
    const existing = rawEvents?.find(e => e.type === stepDef.type);
    if (existing) {
      return existing;
    }
    return {
      id: `step_${stepDef.type.toLowerCase()}`,
      type: stepDef.type,
      status: 'pending' as const,
      label: stepDef.label,
      timestamp: 0
    };
  });

  // Calculate high-level summary metrics
  const inspectedCount = investigation?.evidence 
    ? new Set(investigation.evidence.map(e => e.filePath)).size 
    : undefined;
  const verifiedCount = investigation?.evidence 
    ? investigation.evidence.filter(e => e.verified || e.evidenceType === 'prediction_usage').length 
    : undefined;

  const isRecoverable = !isLive && (investigation?.status === 'recoverable_error' || (Boolean(providerError) && (investigation?.evidence?.length || 0) > 0));
  const isCompleted = !isLive && !providerError && (investigation?.status === 'completed' || displaySteps.every(s => s.status === 'completed'));
  const hasFailed = !isRecoverable && Boolean(providerError || investigation?.status === 'failed' || displaySteps.some(s => s.status === 'failed'));

  return (
    <div 
      id="exynox-investigation-panel"
      className="w-full bg-[#0d121f] rounded-xl border border-zinc-800/90 shadow-sm overflow-hidden text-zinc-100 mb-4 transition-all duration-200"
    >
      {/* Panel Header */}
      <div 
        id="investigation-panel-header"
        className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between bg-[#111624]/60"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
            <Sparkles className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-zinc-200 tracking-tight">
              ExynoX Investigation
            </span>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800/70">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Investigating repository
              </span>
            )}
            {isCompleted && !isCollapsed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                <Check className="w-3 h-3 text-emerald-400" />
                Investigation complete
              </span>
            )}
            {isRecoverable && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                AI synthesis unavailable — evidence verified
              </span>
            )}
            {hasFailed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                Investigation stopped
              </span>
            )}
          </div>
        </div>

        {/* Collapsed/Expanded Toggle (Available once completed or upon user request) */}
        {!isLive && (
          <button
            type="button"
            id="btn-toggle-investigation-panel"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800/50 transition-colors cursor-pointer"
            aria-label={isCollapsed ? "Expand investigation panel" : "Collapse investigation panel"}
          >
            <span className="text-[11px] font-mono">
              {isCollapsed ? 'Show steps' : 'Hide steps'}
            </span>
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>
        )}
      </div>

      {/* Compact summary bar shown when collapsed */}
      {isCollapsed && isCompleted && (
        <div 
          id="investigation-collapsed-summary"
          className="px-4 py-2.5 flex items-center justify-between text-xs text-zinc-300 bg-[#0d121f]"
        >
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span className="font-medium text-zinc-200">Investigation complete</span>
            <span className="text-zinc-500 font-mono">·</span>
            <span className="text-zinc-400 font-mono text-[11px]">
              {inspectedCount !== undefined ? `${inspectedCount} files inspected` : 'Candidate files inspected'}
              {verifiedCount !== undefined ? ` · ${verifiedCount} usages verified` : ''}
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Evidence verified
          </span>
        </div>
      )}

      {/* Expanded Step List */}
      {!isCollapsed && (
        <div id="investigation-panel-body" className="p-4 space-y-2.5">
          <div className="space-y-2">
            {displaySteps.map((step) => {
              const isStepRunning = step.status === 'running';
              const isStepCompleted = step.status === 'completed';
              const isStepFailed = step.status === 'failed';
              const isStepPending = step.status === 'pending';

              return (
                <div 
                  key={step.type}
                  id={`investigation-step-${step.type.toLowerCase()}`}
                  className="flex items-start gap-2.5 text-xs transition-colors py-0.5"
                >
                  {/* Status Indicator Icon */}
                  <div className="flex items-center justify-center w-4 h-4 mt-0.5 shrink-0">
                    {isStepCompleted && (
                      <span className="text-emerald-400 font-bold text-xs" aria-label="Completed">
                        ✓
                      </span>
                    )}
                    {isStepRunning && (
                      <span className="relative flex h-2.5 w-2.5" aria-label="Running">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                      </span>
                    )}
                    {isStepPending && (
                      <span className="text-zinc-600 font-mono text-xs" aria-label="Pending">
                        ○
                      </span>
                    )}
                    {isStepFailed && (
                      <span className="text-rose-400 font-bold text-xs" aria-label="Failed">
                        ⚠
                      </span>
                    )}
                  </div>

                  {/* Step Label & Metadata */}
                  <div className="flex-1 flex items-center justify-between flex-wrap gap-x-2 gap-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-normal ${
                        isStepCompleted ? 'text-zinc-200' :
                        isStepRunning ? 'text-cyan-300 font-medium' :
                        isStepFailed ? 'text-rose-300 font-medium' :
                        'text-zinc-500'
                      }`}>
                        {step.label}
                        {isStepRunning && '...'}
                      </span>

                      {/* Compact Detail (e.g. "· 12 files") */}
                      {isStepCompleted && step.detail && (
                        <span className="text-[11px] font-mono text-zinc-400">
                          &bull; {step.detail}
                        </span>
                      )}

                      {isStepFailed && step.detail && (
                        <span className="text-[11px] font-mono text-rose-400">
                          &bull; {step.detail}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Completed Footer / Verified Badge */}
          {(isCompleted || isRecoverable) && (
            <div 
              id="investigation-panel-footer"
              className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 font-mono"
            >
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Evidence verified</span>
              </div>
              <div>
                {inspectedCount !== undefined && verifiedCount !== undefined && (
                  <span>
                    {inspectedCount} {inspectedCount === 1 ? 'file' : 'files'} inspected &bull; {verifiedCount} {verifiedCount === 1 ? 'usage' : 'usages'} verified
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
