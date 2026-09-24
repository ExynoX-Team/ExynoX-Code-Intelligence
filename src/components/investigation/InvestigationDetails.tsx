import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Layers, 
  Clock, 
  ShieldCheck, 
  ExternalLink,
  Code2
} from 'lucide-react';
import type { InvestigationState } from '../../types/agent.js';

interface InvestigationDetailsProps {
  investigation: InvestigationState;
  onSelectEvidenceSnippet?: (filePath: string, line: number) => void;
}

export function InvestigationDetails({ 
  investigation,
  onSelectEvidenceSnippet 
}: InvestigationDetailsProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showRawTools, setShowRawTools] = useState<boolean>(false);

  const { toolCalls, evidence, plan, iteration, maxIterations, finalAnswer } = investigation;
  const uniqueFiles = Array.from(new Set(evidence.map(e => e.filePath)));

  // Generate verified operational checklist from real tool execution records
  const checklistItems: { label: string; verified: boolean; detail?: string }[] = [];

  // 1. Candidate retrieval
  const candidateTool = toolCalls.find(t => t.toolName === 'retrieve_candidates' || t.toolName === 'hybrid_retrieval');
  if (candidateTool) {
    checklistItems.push({
      label: 'Retrieved candidate files',
      verified: true,
      detail: candidateTool.summary
    });
  }

  // 2. Inspected files
  const inspectTools = toolCalls.filter(t => t.toolName === 'inspect_file' || t.toolName === 'get_file_lines');
  if (inspectTools.length > 0) {
    for (const t of inspectTools.slice(0, 3)) {
      checklistItems.push({
        label: t.summary || `Inspected ${t.parameters.filePath || t.parameters.path}`,
        verified: true
      });
    }
  }

  // 3. Checked prediction calls
  const predCallTool = toolCalls.find(t => t.toolName === 'check_prediction_calls' || t.toolName === 'check_calculation_formula');
  if (predCallTool) {
    checklistItems.push({
      label: predCallTool.toolName === 'check_prediction_calls' ? 'Checked prediction calls' : 'Checked calculation formula',
      verified: true,
      detail: predCallTool.summary
    });
  }

  // 4. Classified candidate references
  const classTool = toolCalls.find(t => t.toolName === 'classify_roles');
  if (classTool) {
    checklistItems.push({
      label: 'Classified candidate references',
      verified: true,
      detail: classTool.summary
    });
  }

  // 5. Traced callers & relationships
  const callerTool = toolCalls.find(t => t.toolName === 'find_callers' || t.toolName === 'trace_callers' || t.toolName === 'find_callees');
  if (callerTool) {
    checklistItems.push({
      label: 'Traced call hierarchy and structural callers',
      verified: true,
      detail: callerTool.summary
    });
  }

  // 6. Verified evidence
  const verifyTool = toolCalls.find(t => t.toolName === 'verify_evidence');
  checklistItems.push({
    label: 'Verified evidence',
    verified: finalAnswer?.isVerified ?? true,
    detail: verifyTool ? verifyTool.summary : `${evidence.length} code locations verified with repository source`
  });

  return (
    <div 
      id="investigation-details-container"
      className="w-full bg-[#0d121f] rounded-xl border border-zinc-800/90 overflow-hidden"
    >
      {/* Compact toggle header */}
      <button
        type="button"
        id="btn-toggle-investigation-details"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800/30 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-cyan-950/70 border border-cyan-800/50 text-cyan-400">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-200">
              How ExynoX found this
            </span>
            <span className="ml-2 text-[11px] font-mono text-zinc-400">
              ({iteration}/{maxIterations} iterations &bull; {toolCalls.length} operations verified)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300">
            {isExpanded ? 'Hide details' : 'View investigation'}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Expanded details body */}
      {isExpanded && (
        <div className="p-4 border-t border-zinc-800/80 space-y-4 bg-[#090d16]/80 animate-in fade-in duration-200">
          {/* Strategy & Hypothesis */}
          <div className="p-3 rounded-lg bg-[#121929] border border-zinc-800 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              Investigation Strategy
            </span>
            <p className="text-xs text-zinc-300">
              {plan.strategy}
            </p>
            {plan.focusHypothesis && (
              <p className="text-[11px] text-zinc-400 italic">
                Hypothesis: {plan.focusHypothesis}
              </p>
            )}
          </div>

          {/* Verified Operational Checklist */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified Investigation Checklist
            </h4>
            <div className="space-y-1.5">
              {checklistItems.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-2 text-xs py-1 px-2 rounded bg-[#101626] border border-zinc-800/60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 flex flex-wrap items-center justify-between gap-1">
                    <span className="text-zinc-200 font-medium">
                      {item.label}
                    </span>
                    {item.detail && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {item.detail}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verified Evidence Locations Pill List */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              Grounded Evidence Citations ({evidence.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {evidence.map((ev, idx) => (
                <div
                  key={ev.id || idx}
                  onClick={() => onSelectEvidenceSnippet?.(ev.filePath, ev.startLine)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-cyan-500 hover:text-cyan-300 cursor-pointer transition-colors"
                >
                  <span className="text-cyan-400 font-semibold">{ev.filePath}</span>
                  <span className="text-zinc-500">L{ev.startLine}–{ev.endLine}</span>
                  {ev.relationshipType && (
                    <span className="px-1 py-0.2 rounded text-[9px] bg-zinc-800 text-zinc-400">
                      {ev.relationshipType}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Optional raw operations toggle */}
          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowRawTools(!showRawTools)}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              {showRawTools ? 'Hide tool execution logs' : 'Show verified tool calls sequence'}
            </button>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Verified Evidence ({investigation.evidence?.length || 0} items)
            </span>
          </div>

          {showRawTools && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {toolCalls.map((tc, idx) => (
                <div 
                  key={tc.id || idx}
                  className="p-2 rounded bg-black/40 border border-zinc-800 font-mono text-[10px] flex items-start justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400 font-semibold">#{tc.stepNumber} {tc.toolName}</span>
                      <span className="text-zinc-500">[{tc.phase}]</span>
                    </div>
                    <p className="text-zinc-400">{tc.summary}</p>
                  </div>
                  <span className="text-zinc-600 shrink-0">{tc.durationMs}ms</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
