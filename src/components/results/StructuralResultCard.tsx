import React from 'react';
import { 
  GitFork, 
  ArrowRight, 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Workflow, 
  CornerDownRight, 
  Search, 
  ExternalLink 
} from 'lucide-react';
import type { StructuralQueryResult, CallChainStep, ReferenceItem } from '../../types/structural.js';

interface StructuralResultCardProps {
  structuralResult: StructuralQueryResult;
}

export function StructuralResultCard({ structuralResult }: StructuralResultCardProps) {
  const { queryType, targetSymbol, matchedItemsCount, explanation, callChain, referenceItems } = structuralResult;

  const getQueryTypeLabel = () => {
    switch (queryType) {
      case 'find_call_chain':
        return 'Call Chain Trace';
      case 'find_callers':
        return 'Static Callers';
      case 'find_callees':
        return 'Static Callees';
      case 'find_imported_by':
        return 'Module Dependents';
      case 'find_imports':
        return 'Module Imports';
      case 'find_references':
        return 'Symbol References';
      case 'find_function_def':
        return 'Function Definition';
      case 'find_class_def':
        return 'Class Definition';
      case 'list_file_functions':
        return 'File Functions';
      case 'list_file_classes':
        return 'File Classes';
      default:
        return 'Structural Analysis';
    }
  };

  return (
    <div 
      id="structural-result-card" 
      className="rounded-xl bg-[#0e131f] border border-cyan-900/40 p-4 shadow-md space-y-3"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            {queryType === 'find_call_chain' ? (
              <Workflow className="w-4 h-4" />
            ) : (
              <GitFork className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-200">
                {getQueryTypeLabel()}
              </span>
              <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-zinc-800/90 text-cyan-300 border border-zinc-700/80">
                {targetSymbol}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Deterministic AST relationship engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded font-mono text-xs border ${
            matchedItemsCount > 0 
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60' 
              : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
          }`}>
            {matchedItemsCount} {matchedItemsCount === 1 ? 'match' : 'matches'}
          </span>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="px-3.5 py-2.5 rounded-lg bg-[#141b2d] border border-cyan-900/30 text-xs text-zinc-200 leading-relaxed flex items-start gap-2">
        {matchedItemsCount > 0 ? (
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        )}
        <div>
          <span className="font-medium text-cyan-200">{explanation}</span>
        </div>
      </div>

      {/* Visual Call Chain Steps (if Call Chain query) */}
      {queryType === 'find_call_chain' && callChain && (
        <div id="call-chain-timeline" className="mt-3 space-y-2">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
            Execution Call Chain ({callChain.steps.length} hops)
          </div>

          {callChain.steps.length === 0 ? (
            <div className="text-xs text-zinc-400 px-3 py-2 bg-zinc-900/60 rounded-lg border border-zinc-800 font-mono">
              No static path found between the requested symbols.
            </div>
          ) : (
            <div className="relative pl-3 space-y-2 border-l-2 border-cyan-900/60 ml-2 py-1">
              {callChain.steps.map((step: CallChainStep) => (
                <div 
                  key={`step_${step.stepIndex}`} 
                  className="relative group bg-[#111622] hover:bg-[#151c2c] transition-colors rounded-lg border border-zinc-800 p-2.5 text-xs font-mono"
                >
                  <div className="absolute -left-[19px] top-3 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-[#0e131f]" />
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-400 mb-1">
                    <span className="font-semibold text-cyan-300">
                      Hop #{step.stepIndex}
                    </span>
                    <span className="text-zinc-500">
                      {step.filePath}:{step.line}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-200 font-medium">
                    <span className="text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-900/60">
                      {step.fromSymbol}()
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900/60">
                      {step.toSymbol}()
                    </span>
                  </div>
                  {step.snippet && (
                    <div className="mt-2 text-[11px] bg-[#090d16] text-zinc-300 p-1.5 rounded border border-zinc-800/80 font-mono overflow-x-auto">
                      {step.snippet}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reference Type Breakdown (if references query) */}
      {queryType === 'find_references' && referenceItems && referenceItems.length > 0 && (
        <div id="reference-breakdown" className="pt-2 border-t border-zinc-800/80">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Reference Distribution
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(
              referenceItems.reduce((acc, item) => {
                acc[item.referenceType] = (acc[item.referenceType] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => (
              <span 
                key={type} 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800/90 text-zinc-300 border border-zinc-700"
              >
                <span className="capitalize">{type.replace('_', ' ')}</span>
                <span className="font-semibold text-cyan-300">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
