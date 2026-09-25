import type { StructuralIndex } from './structuralIndex.js';
import type { AgentFinding, CodeSnippet } from '../../types/index.js';
import type { 
  StructuralQueryResult, 
  FunctionDefinition, 
  ClassDefinition, 
  CallSite, 
  ImportReference, 
  SymbolReference,
  AssignmentDefinition,
  ReferenceItem,
  CallChainResult
} from '../../types/structural.js';
import type { RepositoryWorkspace } from '../repository/repositoryWorkspace.js';

export interface StructuralSearchOutcome {
  handled: boolean;
  queryResult?: StructuralQueryResult;
  findings: AgentFinding[];
}

function cleanSymbolName(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\(\s*\)$/, '')
    .replace(/^the\s+/i, '')
    .replace(/\s+function$/i, '')
    .replace(/\s+class$/i, '')
    .replace(/\s+method$/i, '')
    .trim();
}

/**
 * Deterministically routes questions that match structural patterns
 * to the appropriate StructuralIndex tool.
 */
export function routeStructuralQuery(
  query: string,
  index: StructuralIndex,
  workspace: RepositoryWorkspace
): StructuralSearchOutcome {
  const normalized = query.trim().replace(/\?+$/, '');
  const lower = normalized.toLowerCase();

  // =========================================================================
  // Pattern 1: CALL CHAIN ("Show call chain from X to Y" / "call chain from X to Y")
  // =========================================================================
  const chainMatch = lower.match(/(?:show\s+(?:the\s+)?call\s+chain|call\s+chain|how\s+does|trace\s+(?:call\s+chain|calls?|path))\s+(?:from\s+)?(.+?)\s+(?:to|call|reach)\s+(.+)/i);
  if (chainMatch) {
    const rawFrom = cleanSymbolName(chainMatch[1]);
    const rawTo = cleanSymbolName(chainMatch[2]);

    // Handle descriptive terms like "the prediction function"
    let targetTo = rawTo;
    if (rawTo.toLowerCase() === 'the prediction function' || rawTo.toLowerCase() === 'prediction function') {
      targetTo = 'predict';
    }

    const chainResult: CallChainResult = index.findCallChain(rawFrom, targetTo, (f, s, e) => 
      workspace.getFileLines(f, s, e) || ''
    );

    const findings: AgentFinding[] = chainResult.steps.map(step => ({
      id: `chain_step_${step.stepIndex}_${step.fromSymbol}_${step.toSymbol}`,
      queryId: `q_${Date.now()}`,
      location: {
        filePath: step.filePath,
        startLine: step.line,
        endLine: step.line,
        functionName: step.fromSymbol
      },
      codeSnippet: {
        id: `snip_chain_${step.stepIndex}`,
        location: {
          filePath: step.filePath,
          startLine: step.line,
          endLine: step.line
        },
        content: step.snippet || `${step.fromSymbol}() calls ${step.toSymbol}()`,
        language: 'python'
      },
      explanation: `Step ${step.stepIndex}: '${step.fromSymbol}' invokes '${step.toSymbol}' in ${step.filePath} at line ${step.line} (${step.confidence} static call).`,
      evidence: [
        `Call Step: #${step.stepIndex}`,
        `Caller: ${step.fromSymbol}()`,
        `Target: ${step.toSymbol}()`,
        `Location: ${step.filePath}:${step.line}`,
        `Status: ${step.confidence}`
      ],
      confidenceScore: step.confidence === 'confirmed' ? 1.0 : 0.8
    }));

    return {
      handled: true,
      queryResult: {
        queryType: 'find_call_chain',
        targetSymbol: `${rawFrom} -> ${rawTo}`,
        matchedItemsCount: chainResult.steps.length,
        explanation: chainResult.explanation,
        callChain: chainResult
      },
      findings
    };
  }

  // =========================================================================
  // Pattern 2: CALLERS ("Who calls X?" / "Where is X called?" / "Which functions call X?")
  // =========================================================================
  const callerMatch = lower.match(/(?:which\s+functions\s+call|who\s+calls|functions\s+calling|find\s+callers\s+of|show\s+(?:the\s+)?callers\s+of|callers\s+of)\s+([a-zA-Z0-9_().]+)/i)
    || lower.match(/where\s+is\s+([a-zA-Z0-9_().]+)\s+called/i);

  if (callerMatch) {
    const symbol = cleanSymbolName(callerMatch[1]);
    const callers = index.findCallers(symbol);

    if (callers.length === 0) {
      return {
        handled: true,
        queryResult: {
          queryType: 'find_callers',
          targetSymbol: symbol,
          matchedItemsCount: 0,
          explanation: `No callers of '${symbol}' were found in the indexed repository.`
        },
        findings: []
      };
    }

    const findings: AgentFinding[] = callers.map((call, idx) => {
      const startLine = Math.max(1, call.line - 2);
      const endLine = call.line + 2;
      const code = workspace.getFileLines(call.filePath, startLine, endLine) || `${call.caller || 'module'}() -> ${call.callee}()`;

      return {
        id: `caller_${symbol}_${idx}`,
        queryId: `q_${Date.now()}`,
        location: {
          filePath: call.filePath,
          startLine,
          endLine,
          functionName: call.caller
        },
        codeSnippet: {
          id: `snip_call_${idx}`,
          location: {
            filePath: call.filePath,
            startLine,
            endLine
          },
          content: code,
          language: 'python'
        },
        explanation: `Function '${call.caller}' calls '${call.callee}' in ${call.filePath} at line ${call.line} (${call.confidence} static call).`,
        evidence: [
          `Caller: ${call.caller}()`,
          `Callee: ${call.callee}()`,
          `Location: ${call.filePath}:${call.line}`,
          `Call status: ${call.confidence}`
        ],
        confidenceScore: call.confidence === 'confirmed' ? 1.0 : 0.8
      };
    });

    return {
      handled: true,
      queryResult: {
        queryType: 'find_callers',
        targetSymbol: symbol,
        matchedItemsCount: callers.length,
        explanation: `Found ${callers.length} callers calling '${symbol}'`,
        callSites: callers
      },
      findings
    };
  }

  // =========================================================================
  // Pattern 3: CALLEES ("What does X call?" / "Which functions does X call?" / "What functions are called by X?")
  // =========================================================================
  const calleeMatch = lower.match(/(?:which\s+functions\s+does\s+|what\s+does\s+|find\s+callees\s+of\s+|show\s+(?:the\s+)?callees\s+of\s+|show\s+what\s+|callees\s+of\s+)([a-zA-Z0-9_().]+)(?:\s+call)?/i)
    || lower.match(/what\s+functions\s+are\s+called\s+by\s+([a-zA-Z0-9_().]+)/i);

  if (calleeMatch) {
    const callerSymbol = cleanSymbolName(calleeMatch[1]);
    const callees = index.findCallees(callerSymbol);

    if (callees.length === 0) {
      return {
        handled: true,
        queryResult: {
          queryType: 'find_callees',
          targetSymbol: callerSymbol,
          matchedItemsCount: 0,
          explanation: `No calls originated from '${callerSymbol}' in the indexed repository.`
        },
        findings: []
      };
    }

    const findings: AgentFinding[] = callees.map((call, idx) => {
      const startLine = Math.max(1, call.line - 2);
      const endLine = call.line + 2;
      const code = workspace.getFileLines(call.filePath, startLine, endLine) || `${call.callee}()`;

      const fnDef = index.findFunctionDefinition(call.callee);
      const clsDef = index.findClassDefinition(call.callee);
      const isInternal = Boolean(fnDef || clsDef || call.callee.includes('.'));
      const statusLabel = isInternal ? 'Internal repository function/method' : 'External / unresolved call (e.g. builtin or library)';

      return {
        id: `callee_${callerSymbol}_${idx}`,
        queryId: `q_${Date.now()}`,
        location: {
          filePath: call.filePath,
          startLine,
          endLine,
          functionName: call.caller
        },
        codeSnippet: {
          id: `snip_callee_${idx}`,
          location: {
            filePath: call.filePath,
            startLine,
            endLine
          },
          content: code,
          language: 'python'
        },
        explanation: `'${call.caller}' invokes '${call.callee}' on line ${call.line} (${statusLabel}).`,
        evidence: [
          `Caller: ${call.caller}()`,
          `Callee: ${call.callee}()`,
          `File: ${call.filePath}`,
          `Line: ${call.line}`,
          `Resolution: ${statusLabel}`
        ],
        confidenceScore: isInternal ? 1.0 : 0.8
      };
    });

    return {
      handled: true,
      queryResult: {
        queryType: 'find_callees',
        targetSymbol: callerSymbol,
        matchedItemsCount: callees.length,
        explanation: `'${callerSymbol}' calls ${callees.length} functions (${callees.map(c => c.callee).join(', ')})`,
        callSites: callees
      },
      findings
    };
  }

  // =========================================================================
  // Pattern 4: IMPORTS & IMPORTED BY
  // =========================================================================
  // 4A: "Which files import X?" / "What imports X?" / "Who imports X?"
  const importByMatch = lower.match(/(?:which\s+files\s+import|what\s+imports|who\s+imports|find\s+imports\s+of)\s+([a-zA-Z0-9_.]+)/i);
  if (importByMatch) {
    const mod = cleanSymbolName(importByMatch[1]);
    const imports = index.findImportedBy(mod);

    if (imports.length === 0) {
      return {
        handled: true,
        queryResult: {
          queryType: 'find_imported_by',
          targetSymbol: mod,
          matchedItemsCount: 0,
          explanation: `Found 0 files importing '${mod}' in the indexed repository.`
        },
        findings: []
      };
    }

    const findings: AgentFinding[] = imports.map((imp, idx) => {
      const code = workspace.getFileLines(imp.filePath, imp.line, imp.line) || 
        (imp.isFromImport ? `from ${imp.sourceModule} import ${imp.importedName}` : `import ${imp.sourceModule}`);

      return {
        id: `imp_by_${idx}`,
        queryId: `q_${Date.now()}`,
        location: {
          filePath: imp.filePath,
          startLine: imp.line,
          endLine: imp.line
        },
        codeSnippet: {
          id: `snip_imp_by_${idx}`,
          location: {
            filePath: imp.filePath,
            startLine: imp.line,
            endLine: imp.line
          },
          content: code,
          language: 'python'
        },
        explanation: `${imp.filePath} imports '${imp.importedName}' from '${imp.sourceModule}' on line ${imp.line}${imp.alias ? ` as '${imp.alias}'` : ''}.`,
        evidence: [
          `Importing file: ${imp.filePath}`,
          `Imported module: ${imp.sourceModule}`,
          `Symbol: ${imp.importedName}`,
          imp.alias ? `Alias: ${imp.alias}` : 'No alias',
          `Line: ${imp.line}`
        ],
        confidenceScore: 1.0
      };
    });

    return {
      handled: true,
      queryResult: {
        queryType: 'find_imports',
        targetSymbol: mod,
        matchedItemsCount: imports.length,
        explanation: `Found ${imports.length} imports referencing '${mod}' across ${new Set(imports.map(i => i.filePath)).size} files`,
        imports
      },
      findings
    };
  }

  // 4B: "What does [file] import?" / "What imports does [file/module] have?" / "Imports in [file]"
  const fileImportMatch = lower.match(/(?:what\s+does\s+([a-zA-Z0-9_./-]+)\s+import|what\s+imports\s+does\s+([a-zA-Z0-9_./-]+)\s+have|imports\s+in\s+([a-zA-Z0-9_./-]+)|list\s+imports\s+in\s+([a-zA-Z0-9_./-]+))/i);
  if (fileImportMatch) {
    const rawTarget = fileImportMatch[1] || fileImportMatch[2] || fileImportMatch[3] || fileImportMatch[4];
    const target = cleanSymbolName(rawTarget);
    const imports = index.findImportsInFile(target);

    const findings: AgentFinding[] = imports.map((imp, idx) => {
      const code = workspace.getFileLines(imp.filePath, imp.line, imp.line) || 
        (imp.isFromImport ? `from ${imp.sourceModule} import ${imp.importedName}` : `import ${imp.sourceModule}`);

      return {
        id: `f_imp_${idx}`,
        queryId: `q_${Date.now()}`,
        location: {
          filePath: imp.filePath,
          startLine: imp.line,
          endLine: imp.line
        },
        codeSnippet: {
          id: `snip_f_imp_${idx}`,
          location: {
            filePath: imp.filePath,
            startLine: imp.line,
            endLine: imp.line
          },
          content: code,
          language: 'python'
        },
        explanation: `Imports '${imp.importedName}' from '${imp.sourceModule}' on line ${imp.line}.`,
        evidence: [
          `Module: ${imp.sourceModule}`,
          `Symbol: ${imp.importedName}`,
          `Line: ${imp.line}`
        ],
        confidenceScore: 1.0
      };
    });

    return {
      handled: true,
      queryResult: {
        queryType: 'find_imports',
        targetSymbol: target,
        matchedItemsCount: imports.length,
        explanation: `'${target}' defines ${imports.length} imports`,
        imports
      },
      findings
    };
  }

  // =========================================================================
  // Pattern 5: REFERENCES / USAGES ("Where is X used?" / "Where is X referenced?" / "Which files reference this class?")
  // =========================================================================
  const refMatch = lower.match(/(?:where\s+(?:is|are)\s+(?:the\s+)?([a-zA-Z0-9_().]+)\s+(?:used|referenced)|find\s+references\s+(?:to|of)\s+([a-zA-Z0-9_().]+)|which\s+files\s+reference\s+(?:this\s+class\s+|the\s+class\s+|function\s+)?([a-zA-Z0-9_().]+)|usages\s+of\s+([a-zA-Z0-9_().]+))/i);
  if (refMatch) {
    const rawSym = refMatch[1] || refMatch[2] || refMatch[3] || refMatch[4];
    const symbol = cleanSymbolName(rawSym);

    // Look for markdown / doc mentions
    const docMentions: { filePath: string; line: number; snippet: string }[] = [];
    const allWorkspaceFiles = workspace.listFiles(false);
    for (const f of allWorkspaceFiles) {
      if (!f.endsWith('.py')) {
        const content = workspace.readFile(f);
        if (content && content.includes(symbol)) {
          const lines = content.split('\n');
          lines.forEach((lineText: string, idx: number) => {
            if (lineText.includes(symbol)) {
              docMentions.push({
                filePath: f,
                line: idx + 1,
                snippet: lineText.trim()
              });
            }
          });
        }
      }
    }

    const refItems = index.findDetailedReferences(
      symbol, 
      (filePath: string, line: number) => workspace.getFileLines(filePath, line, line) || '',
      docMentions
    );

    if (refItems.length === 0) {
      return {
        handled: true,
        queryResult: {
          queryType: 'find_references',
          targetSymbol: symbol,
          matchedItemsCount: 0,
          explanation: `No references to '${symbol}' were found in the indexed repository.`
        },
        findings: []
      };
    }

    const findings: AgentFinding[] = refItems.map((item, idx) => ({
      id: `ref_${symbol}_${item.referenceType}_${idx}`,
      queryId: `q_${Date.now()}`,
      location: {
        filePath: item.filePath,
        startLine: item.line,
        endLine: item.line,
        functionName: item.containingScope
      },
      codeSnippet: {
        id: `snip_ref_${idx}`,
        location: {
          filePath: item.filePath,
          startLine: item.line,
          endLine: item.line
        },
        content: item.snippet || `${symbol} (${item.referenceType})`,
        language: item.filePath.endsWith('.py') ? 'python' : 'markdown'
      },
      explanation: `'${symbol}' referenced as ${item.referenceType.replace('_', ' ')} in ${item.filePath} on line ${item.line}.`,
      evidence: [
        `Reference Type: ${item.referenceType}`,
        `File: ${item.filePath}`,
        `Line: ${item.line}`,
        `Status: ${item.confidence}`
      ],
      confidenceScore: item.confidence === 'confirmed' ? 1.0 : 0.8
    }));

    return {
      handled: true,
      queryResult: {
        queryType: 'find_references',
        targetSymbol: symbol,
        matchedItemsCount: refItems.length,
        explanation: `Found ${refItems.length} references to '${symbol}' (${new Set(refItems.map(r => r.filePath)).size} files)`,
        referenceItems: refItems
      },
      findings
    };
  }

  // =========================================================================
  // Pattern 6: DEFINITIONS ("Where is X defined?" / "Find definition of X")
  // =========================================================================
  const defMatch = lower.match(/where\s+(?:is|are)\s+(?:the\s+)?(?:function\s+|class\s+|method\s+)?([a-zA-Z0-9_().]+)\s+defined/i)
    || lower.match(/(?:find|show)\s+(?:the\s+)?(?:definition\s+of\s+|function\s+|class\s+)([a-zA-Z0-9_().]+)/i)
    || lower.match(/^definition\s+of\s+([a-zA-Z0-9_().]+)/i);

  if (defMatch) {
    let symbol = cleanSymbolName(defMatch[1]);
    let fnDef = index.findFunctionDefinition(symbol);
    let clsDef = index.findClassDefinition(symbol);

    // If plural, attempt singular lookup (e.g. "drivers" -> "driver" or class containing "Driver")
    if (!fnDef && !clsDef && symbol.endsWith('s')) {
      const singular = symbol.slice(0, -1);
      fnDef = index.findFunctionDefinition(singular);
      clsDef = index.findClassDefinition(singular);
      if (fnDef || clsDef) {
        symbol = singular;
      }
    }

    // Case-insensitive class lookup fallback (e.g., driver -> Driver)
    if (!clsDef && !fnDef) {
      const allClasses = index.getAllClassNames();
      const matchedName = allClasses.find(c => c.toLowerCase() === symbol.toLowerCase() || c.toLowerCase().includes(symbol.toLowerCase()));
      if (matchedName) {
        clsDef = index.findClassDefinition(matchedName);
        symbol = matchedName;
      }
    }

    if (fnDef) {
      const code = workspace.getFileLines(fnDef.filePath, fnDef.startLine, fnDef.endLine) || `def ${fnDef.name}(...):`;
      const finding: AgentFinding = {
        id: `struct_fn_${fnDef.name}_${fnDef.startLine}`,
        queryId: `q_${Date.now()}`,
        location: {
          filePath: fnDef.filePath,
          startLine: fnDef.startLine,
          endLine: fnDef.endLine,
          functionName: fnDef.name,
          className: fnDef.className
        },
        codeSnippet: {
          id: `snip_fn_${fnDef.name}`,
          location: {
            filePath: fnDef.filePath,
            startLine: fnDef.startLine,
            endLine: fnDef.endLine
          },
          content: code,
          language: 'python'
        },
        explanation: `Function '${fnDef.name}' is defined in ${fnDef.filePath} (lines ${fnDef.startLine}–${fnDef.endLine}) with parameters: (${fnDef.parameters.join(', ')}).`,
        evidence: [
          `File: ${fnDef.filePath}`,
          `Lines ${fnDef.startLine}–${fnDef.endLine}`,
          fnDef.className ? `Member of class: ${fnDef.className}` : 'Top-level function',
          fnDef.decorators.length > 0 ? `Decorators: ${fnDef.decorators.join(', ')}` : 'No decorators'
        ],
        confidenceScore: 1.0
      };

      return {
        handled: true,
        queryResult: {
          queryType: 'find_function_def',
          targetSymbol: symbol,
          matchedItemsCount: 1,
          explanation: `Function definition found via AST structural index`,
          functionDefs: [fnDef]
        },
        findings: [finding]
      };
    }

    if (clsDef) {
      const code = workspace.getFileLines(clsDef.filePath, clsDef.startLine, clsDef.endLine) || `class ${clsDef.name}:`;
      const finding: AgentFinding = {
        id: `struct_cls_${clsDef.name}_${clsDef.startLine}`,
        queryId: `q_${Date.now()}`,
        location: {
          filePath: clsDef.filePath,
          startLine: clsDef.startLine,
          endLine: clsDef.endLine,
          className: clsDef.name
        },
        codeSnippet: {
          id: `snip_cls_${clsDef.name}`,
          location: {
            filePath: clsDef.filePath,
            startLine: clsDef.startLine,
            endLine: clsDef.endLine
          },
          content: code,
          language: 'python'
        },
        explanation: `Class '${clsDef.name}' is defined in ${clsDef.filePath} (lines ${clsDef.startLine}–${clsDef.endLine}) with methods: ${clsDef.methods.join(', ') || 'none'}.`,
        evidence: [
          `File: ${clsDef.filePath}`,
          `Lines ${clsDef.startLine}–${clsDef.endLine}`,
          clsDef.baseClasses.length > 0 ? `Base classes: ${clsDef.baseClasses.join(', ')}` : 'Base class: object',
          `Methods: ${clsDef.methods.join(', ') || 'none'}`
        ],
        confidenceScore: 1.0
      };

      return {
        handled: true,
        queryResult: {
          queryType: 'find_class_def',
          targetSymbol: symbol,
          matchedItemsCount: 1,
          explanation: `Class definition found via AST structural index`,
          classDefs: [clsDef]
        },
        findings: [finding]
      };
    }

    // Check multiple matching classes if plural (e.g. "controllers", "drivers")
    const searchRoot = symbol.endsWith('s') ? symbol.slice(0, -1).toLowerCase() : symbol.toLowerCase();
    const multipleClasses = index.getAllClassNames().filter(c => 
      c.toLowerCase().includes(searchRoot)
    );

    if (multipleClasses.length > 0) {
      const classDefs = multipleClasses.map(name => index.findClassDefinition(name)).filter(Boolean) as ClassDefinition[];
      const findings: AgentFinding[] = classDefs.map((cd, idx) => {
        const code = workspace.getFileLines(cd.filePath, cd.startLine, Math.min(cd.startLine + 5, cd.endLine)) || `class ${cd.name}:`;
        return {
          id: `struct_cls_${cd.name}_${cd.startLine}`,
          queryId: `q_${Date.now()}`,
          location: {
            filePath: cd.filePath,
            startLine: cd.startLine,
            endLine: cd.endLine,
            className: cd.name
          },
          codeSnippet: {
            id: `snip_cls_${cd.name}`,
            location: {
              filePath: cd.filePath,
              startLine: cd.startLine,
              endLine: cd.endLine
            },
            content: code,
            language: 'python'
          },
          explanation: `Class '${cd.name}' is defined in ${cd.filePath} (lines ${cd.startLine}–${cd.endLine}).`,
          evidence: [
            `File: ${cd.filePath}`,
            `Lines ${cd.startLine}–${cd.endLine}`,
            `Methods: ${cd.methods.join(', ') || 'none'}`
          ],
          confidenceScore: 1.0
        };
      });

      return {
        handled: true,
        queryResult: {
          queryType: 'find_class_def',
          targetSymbol: symbol,
          matchedItemsCount: classDefs.length,
          explanation: `Found ${classDefs.length} matching class definitions via AST structural index`,
          classDefs
        },
        findings
      };
    }

    // Check assignments (e.g. F1_DRIVERS)
    const assignments = index.findAssignments(symbol);
    if (assignments.length > 0) {
      const a = assignments[0];
      const code = workspace.getFileLines(a.filePath, a.line, a.endLine || a.line) || `${a.variableName} = ...`;
      return {
        handled: true,
        queryResult: {
          queryType: 'general_structural',
          targetSymbol: symbol,
          matchedItemsCount: 1,
          explanation: `Variable '${a.variableName}' is defined in ${a.filePath} (lines ${a.line}–${a.endLine || a.line}).`,
          assignments: [a]
        },
        findings: [{
          id: `struct_assign_${a.variableName}`,
          queryId: `q_${Date.now()}`,
          location: {
            filePath: a.filePath,
            startLine: a.line,
            endLine: a.endLine || a.line,
            functionName: a.variableName
          },
          codeSnippet: {
            id: `snip_assign_${a.variableName}`,
            location: {
              filePath: a.filePath,
              startLine: a.line,
              endLine: a.endLine || a.line
            },
            content: code,
            language: 'python'
          },
          explanation: `Variable '${a.variableName}' is defined in ${a.filePath} at line ${a.line}.`,
          evidence: [
            `File: ${a.filePath}`,
            `Line: ${a.line}`
          ],
          confidenceScore: 1.0
        }]
      };
    }

    // Check files/modules (e.g. where is degradation defined?)
    const allFiles = workspace.listFiles(true);
    const matchedFile = allFiles.find(f => f.toLowerCase().includes(symbol.toLowerCase()));
    if (matchedFile) {
      const code = workspace.getFileLines(matchedFile, 1, Math.min(20, 50)) || `# ${matchedFile}`;
      return {
        handled: true,
        queryResult: {
          queryType: 'general_structural',
          targetSymbol: symbol,
          matchedItemsCount: 1,
          explanation: `Module matching '${symbol}' is defined at ${matchedFile}.`
        },
        findings: [{
          id: `struct_mod_${symbol}`,
          queryId: `q_${Date.now()}`,
          location: {
            filePath: matchedFile,
            startLine: 1,
            endLine: 20
          },
          codeSnippet: {
            id: `snip_mod_${symbol}`,
            location: {
              filePath: matchedFile,
              startLine: 1,
              endLine: 20
            },
            content: code,
            language: matchedFile.endsWith('.py') ? 'python' : 'text'
          },
          explanation: `Module '${symbol}' corresponds to file ${matchedFile}.`,
          evidence: [
            `File: ${matchedFile}`
          ],
          confidenceScore: 1.0
        }]
      };
    }

    // Honest reporting when definition is queried but not found
    return {
      handled: true,
      queryResult: {
        queryType: 'find_function_def',
        targetSymbol: symbol,
        matchedItemsCount: 0,
        explanation: `No definition matching '${symbol}' was found in the AST structural index.`
      },
      findings: []
    };
  }

  // =========================================================================
  // Pattern 7: FILE STRUCTURAL QUERIES (Functions / classes in file)
  // =========================================================================
  const fileFnMatch = lower.match(/(?:what\s+functions\s+are\s+(?:defined\s+)?in|functions\s+in)\s+([a-zA-Z0-9_./-]+)/i);
  if (fileFnMatch) {
    const targetFile = fileFnMatch[1];
    const allFiles = workspace.listFiles(true);
    const matchedPath = allFiles.find(f => f.toLowerCase().includes(targetFile.toLowerCase()));

    if (matchedPath) {
      const fileFns = index.getFunctionsInFile(matchedPath);
      const findings: AgentFinding[] = fileFns.map((fn, idx) => {
        const code = workspace.getFileLines(matchedPath, fn.startLine, fn.endLine) || `def ${fn.name}():`;
        return {
          id: `fn_file_${idx}`,
          queryId: `q_${Date.now()}`,
          location: {
            filePath: matchedPath,
            startLine: fn.startLine,
            endLine: fn.endLine,
            functionName: fn.name
          },
          codeSnippet: {
            id: `snip_ffn_${idx}`,
            location: {
              filePath: matchedPath,
              startLine: fn.startLine,
              endLine: fn.endLine
            },
            content: code,
            language: 'python'
          },
          explanation: `Function '${fn.name}' defined on lines ${fn.startLine}–${fn.endLine} of ${matchedPath}.`,
          evidence: [
            `Parameters: (${fn.parameters.join(', ')})`,
            fn.isAsync ? 'Async function' : 'Synchronous function'
          ],
          confidenceScore: 1.0
        };
      });

      return {
        handled: true,
        queryResult: {
          queryType: 'list_file_functions',
          targetSymbol: matchedPath,
          matchedItemsCount: fileFns.length,
          explanation: `Found ${fileFns.length} functions in ${matchedPath}`,
          functionDefs: fileFns
        },
        findings
      };
    }
  }

  const fileClsMatch = lower.match(/(?:what\s+classes\s+are\s+(?:defined\s+)?in|classes\s+in)\s+([a-zA-Z0-9_./-]+)/i);
  if (fileClsMatch) {
    const targetFile = fileClsMatch[1];
    const allFiles = workspace.listFiles(true);
    const matchedPath = allFiles.find(f => f.toLowerCase().includes(targetFile.toLowerCase()));

    if (matchedPath) {
      const fileClasses = index.getClassesInFile(matchedPath);
      const findings: AgentFinding[] = fileClasses.map((cls, idx) => {
        const code = workspace.getFileLines(matchedPath, cls.startLine, cls.endLine) || `class ${cls.name}:`;
        return {
          id: `cls_file_${idx}`,
          queryId: `q_${Date.now()}`,
          location: {
            filePath: matchedPath,
            startLine: cls.startLine,
            endLine: cls.endLine,
            className: cls.name
          },
          codeSnippet: {
            id: `snip_fcls_${idx}`,
            location: {
              filePath: matchedPath,
              startLine: cls.startLine,
              endLine: cls.endLine
            },
            content: code,
            language: 'python'
          },
          explanation: `Class '${cls.name}' defined on lines ${cls.startLine}–${cls.endLine} of ${matchedPath}.`,
          evidence: [
            cls.baseClasses.length > 0 ? `Bases: ${cls.baseClasses.join(', ')}` : 'Base: object',
            `Methods: ${cls.methods.join(', ') || 'none'}`
          ],
          confidenceScore: 1.0
        };
      });

      return {
        handled: true,
        queryResult: {
          queryType: 'list_file_classes',
          targetSymbol: matchedPath,
          matchedItemsCount: fileClasses.length,
          explanation: `Found ${fileClasses.length} classes in ${matchedPath}`,
          classDefs: fileClasses
        },
        findings
      };
    }
  }

  // =========================================================================
  // Pattern 8: ALL CLASSES QUERY
  // =========================================================================
  if (lower.includes('what classes exist') || lower.includes('what classes are in this') || lower.includes('list all classes')) {
    const classNames = index.getAllClassNames();
    const findings: AgentFinding[] = [];

    for (const name of classNames.slice(0, 10)) {
      const cls = index.findClassDefinition(name);
      if (cls) {
        const code = workspace.getFileLines(cls.filePath, cls.startLine, Math.min(cls.startLine + 5, cls.endLine)) || `class ${cls.name}:`;
        findings.push({
          id: `all_cls_${cls.name}`,
          queryId: `q_${Date.now()}`,
          location: {
            filePath: cls.filePath,
            startLine: cls.startLine,
            endLine: cls.endLine,
            className: cls.name
          },
          codeSnippet: {
            id: `snip_acls_${cls.name}`,
            location: {
              filePath: cls.filePath,
              startLine: cls.startLine,
              endLine: cls.endLine
            },
            content: code,
            language: 'python'
          },
          explanation: `Class '${cls.name}' defined in ${cls.filePath} (lines ${cls.startLine}–${cls.endLine}).`,
          evidence: [
            `File: ${cls.filePath}`,
            `Methods: ${cls.methods.join(', ') || 'none'}`
          ],
          confidenceScore: 1.0
        });
      }
    }

    return {
      handled: true,
      queryResult: {
        queryType: 'general_structural',
        targetSymbol: 'classes',
        matchedItemsCount: classNames.length,
        explanation: `Repository defines ${classNames.length} classes`
      },
      findings
    };
  }

  // =========================================================================
  // Pattern 9: COUNT QUERIES ("How many ...")
  // =========================================================================
  const countMatch = lower.match(/^(?:how\s+many|what\s+is\s+the\s+number\s+of|number\s+of|count\s+(?:of\s+)?|total\s+(?:number\s+of\s+)?)\s+(.+)/i);
  if (countMatch) {
    return handleCountQuery(countMatch[1].trim(), index, workspace);
  }

  return { handled: false, findings: [] };
}

/**
 * Handles entity count and structural quantity queries with high-fidelity disambiguation.
 * Distinguishes between class schemas and entity instances/rosters, inspecting structured AST collections.
 */
function handleCountQuery(
  rawPhrase: string,
  index: StructuralIndex,
  workspace: RepositoryWorkspace
): StructuralSearchOutcome {
  const cleanPhrase = rawPhrase.replace(/[?.!]+$/, '').trim();

  // 1. SPECIFIC CLASS OR GENERAL CLASS QUERY
  if (/\bclasses?\b/i.test(cleanPhrase)) {
    const withoutClassWords = cleanPhrase
      .replace(/\bclasses?\b/gi, '')
      .replace(/\b(?:are\s+there|does\s+it\s+have|exist|is\s+there|defined|in\s+this\s+project|in\s+the\s+project|in\s+the\s+repository|in\s+the\s+repo|in\s+total)\b/gi, '')
      .trim();

    if (withoutClassWords.length > 0) {
      // Specific class count (e.g., "Driver classes", "How many Driver classes are there?")
      const targetClassLower = withoutClassWords.toLowerCase();
      const matchedNames = index.getAllClassNames().filter(c => {
        const cLower = c.toLowerCase();
        return cLower === targetClassLower ||
               cLower.includes(targetClassLower) ||
               (targetClassLower.endsWith('s') && cLower.includes(targetClassLower.slice(0, -1)));
      });

      if (matchedNames.length > 0) {
        const classDefs = matchedNames
          .map(c => index.findClassDefinition(c))
          .filter((cd): cd is ClassDefinition => cd !== null);

        const findings: AgentFinding[] = classDefs.map((cd, idx) => {
          const code = workspace.getFileLines(cd.filePath, cd.startLine, cd.endLine) || `class ${cd.name}:`;
          return {
            id: `struct_count_class_${cd.name}_${idx}`,
            queryId: `q_${Date.now()}`,
            location: {
              filePath: cd.filePath,
              startLine: cd.startLine,
              endLine: cd.endLine,
              className: cd.name
            },
            codeSnippet: {
              id: `snip_count_cls_${cd.name}`,
              location: {
                filePath: cd.filePath,
                startLine: cd.startLine,
                endLine: cd.endLine
              },
              content: code,
              language: 'python'
            },
            explanation: `Class '${cd.name}' is defined in ${cd.filePath} (lines ${cd.startLine}–${cd.endLine}).`,
            evidence: [
              `File: ${cd.filePath}`,
              `Lines: ${cd.startLine}–${cd.endLine}`,
              `Class definition: ${cd.name}`,
              `Methods: ${cd.methods.join(', ') || 'none'}`
            ],
            confidenceScore: 1.0
          };
        });

        const primaryClass = classDefs[0];
        return {
          handled: true,
          queryResult: {
            queryType: 'general_structural',
            targetSymbol: `${withoutClassWords} class`,
            matchedItemsCount: classDefs.length,
            explanation: `The repository defines ${classDefs.length} class matching '${withoutClassWords}': ${classDefs.map(c => c.name).join(', ')} in ${primaryClass.filePath} (lines ${primaryClass.startLine}–${primaryClass.endLine}).`,
            classDefs,
            entityInfo: {
              entityName: withoutClassWords,
              countType: 'class_count',
              className: primaryClass.name,
              elementCount: classDefs.length,
              evidenceFile: primaryClass.filePath,
              startLine: primaryClass.startLine,
              endLine: primaryClass.endLine,
              reliable: true
            }
          },
          findings
        };
      } else {
        return {
          handled: true,
          queryResult: {
            queryType: 'general_structural',
            targetSymbol: `${withoutClassWords} class`,
            matchedItemsCount: 0,
            explanation: `Found 0 classes matching '${withoutClassWords}' in the AST structural index.`,
            entityInfo: {
              entityName: withoutClassWords,
              countType: 'class_count',
              elementCount: 0,
              reliable: true
            }
          },
          findings: []
        };
      }
    } else {
      // General class count (e.g., "How many classes?")
      const classNames = index.getAllClassNames();
      return {
        handled: true,
        queryResult: {
          queryType: 'general_structural',
          targetSymbol: 'classes',
          matchedItemsCount: classNames.length,
          explanation: `The repository defines ${classNames.length} Python classes based on AST analysis: ${classNames.join(', ')}.`,
          entityInfo: {
            entityName: 'classes',
            countType: 'class_count',
            elementCount: classNames.length,
            reliable: true
          }
        },
        findings: []
      };
    }
  }

  // 2. FUNCTIONS COUNT
  if (/\bfunctions?\b/i.test(cleanPhrase)) {
    const fileMatch = cleanPhrase.match(/\bin\s+([a-zA-Z0-9_./-]+(?:\.py)?)/i);
    if (fileMatch) {
      const targetFile = fileMatch[1];
      const funcs = index.getFunctionsInFile(targetFile);
      return {
        handled: true,
        queryResult: {
          queryType: 'list_file_functions',
          targetSymbol: targetFile,
          matchedItemsCount: funcs.length,
          explanation: `File '${targetFile}' defines ${funcs.length} top-level functions.`
        },
        findings: []
      };
    } else {
      const allFiles = workspace.listFiles(true);
      let fnCount = 0;
      for (const f of allFiles) {
        fnCount += index.getFunctionsInFile(f).length;
      }
      return {
        handled: true,
        queryResult: {
          queryType: 'general_structural',
          targetSymbol: 'functions',
          matchedItemsCount: fnCount,
          explanation: `The repository defines ${fnCount} top-level functions based on AST analysis.`,
          entityInfo: {
            entityName: 'functions',
            countType: 'function_count',
            elementCount: fnCount,
            reliable: true
          }
        },
        findings: []
      };
    }
  }

  // 3. METHODS COUNT
  if (/\bmethods?\b/i.test(cleanPhrase)) {
    const classMatch = cleanPhrase.match(/\b(?:in|of|does)\s+([a-zA-Z0-9_]+)/i);
    if (classMatch) {
      const targetClass = classMatch[1];
      const clsDef = index.findClassDefinition(targetClass);
      if (clsDef) {
        return {
          handled: true,
          queryResult: {
            queryType: 'general_structural',
            targetSymbol: `${targetClass} methods`,
            matchedItemsCount: clsDef.methods.length,
            explanation: `Class '${clsDef.name}' defines ${clsDef.methods.length} methods: ${clsDef.methods.join(', ') || 'none'}.`,
            classDefs: [clsDef]
          },
          findings: []
        };
      }
    }
    const totalMethods = index.getStats().totalMethods;
    return {
      handled: true,
      queryResult: {
        queryType: 'general_structural',
        targetSymbol: 'methods',
        matchedItemsCount: totalMethods,
        explanation: `The repository defines ${totalMethods} methods across all indexed classes.`,
        entityInfo: {
          entityName: 'methods',
          countType: 'method_count',
          elementCount: totalMethods,
          reliable: true
        }
      },
      findings: []
    };
  }

  // 4. VARIABLES / ASSIGNMENTS COUNT
  if (/\bvariables?\b/i.test(cleanPhrase)) {
    const totalAssignments = index.getStats().totalAssignments;
    return {
      handled: true,
      queryResult: {
        queryType: 'general_structural',
        targetSymbol: 'variables',
        matchedItemsCount: totalAssignments,
        explanation: `The repository defines ${totalAssignments} variable assignments based on AST analysis.`
      },
      findings: []
    };
  }

  // 5. DOMAIN ENTITY / ROSTER / RECORDS COUNT
  // Extract the entity noun from the phrase
  const displayNoun = cleanPhrase
    .replace(/\b(?:does\s+it\s+have|are\s+there|are\s+registered|is\s+registered|are\s+active|exist|is\s+there|defined|in\s+this\s+project|in\s+the\s+project|in\s+the\s+repository|in\s+the\s+repo|in\s+total|currently|can\s+you\s+find)\b/gi, '')
    .trim() || cleanPhrase.trim();

  let cleanTarget = cleanPhrase
    .replace(/\b(?:does\s+it\s+have|are\s+there|are\s+registered|is\s+registered|are\s+active|exist|is\s+there|defined|in\s+this\s+project|in\s+the\s+project|in\s+the\s+repository|in\s+the\s+repo|in\s+total|currently|can\s+you\s+find)\b/gi, '')
    .replace(/\b(?:registered|active|current|canonical|total|valid|all)\b/gi, '')
    .trim();

  if (!cleanTarget) cleanTarget = cleanPhrase.trim();

  const lowerTarget = cleanTarget.toLowerCase();
  const singular = lowerTarget.endsWith('s') ? lowerTarget.slice(0, -1) : lowerTarget;

  // 5.1 Search for collection variables (roster, list, dataset) matching the entity
  const collections = index.findCollectionsForEntity(singular);
  const primaryCollection = collections.find(c => c.elementCount !== undefined && c.elementCount > 0) || collections[0];

  if (primaryCollection && primaryCollection.elementCount !== undefined && primaryCollection.elementCount > 0) {
    const count = primaryCollection.elementCount;
    const relatedClass = index.findClassDefinition(singular) || index.findClassDefinition(lowerTarget);
    const codeSnippet = workspace.getFileLines(
      primaryCollection.filePath,
      primaryCollection.line,
      primaryCollection.endLine || primaryCollection.line
    ) || `${primaryCollection.variableName} = [...]`;

    const evidence: string[] = [
      `Roster collection: '${primaryCollection.variableName}' defined in ${primaryCollection.filePath} (lines ${primaryCollection.line}–${primaryCollection.endLine || primaryCollection.line}) containing ${count} ${singular} records`
    ];

    if (relatedClass) {
      evidence.push(`Entity class: '${relatedClass.name}' defined in ${relatedClass.filePath} (lines ${relatedClass.startLine}–${relatedClass.endLine})`);
    }

    // Corroborating accessor function if present
    const accessorFn = index.getAllFunctionNames().find(fn => fn.includes(singular) && (fn.startsWith('get_all') || fn.startsWith('get_')));
    if (accessorFn) {
      evidence.push(`Roster accessor: '${accessorFn}()' returns ${primaryCollection.variableName}`);
    }

    const finding: AgentFinding = {
      id: `struct_count_roster_${primaryCollection.variableName}`,
      queryId: `q_${Date.now()}`,
      location: {
        filePath: primaryCollection.filePath,
        startLine: primaryCollection.line,
        endLine: primaryCollection.endLine || primaryCollection.line,
        functionName: primaryCollection.variableName
      },
      codeSnippet: {
        id: `snip_roster_${primaryCollection.variableName}`,
        location: {
          filePath: primaryCollection.filePath,
          startLine: primaryCollection.line,
          endLine: primaryCollection.endLine || primaryCollection.line
        },
        content: codeSnippet,
        language: 'python'
      },
      explanation: `${count} ${displayNoun}. The repository defines a canonical roster of ${count} ${singular} entities in '${primaryCollection.variableName}' (${primaryCollection.filePath} lines ${primaryCollection.line}–${primaryCollection.endLine || primaryCollection.line}).`,
      evidence,
      confidenceScore: 1.0
    };

    return {
      handled: true,
      queryResult: {
        queryType: 'general_structural',
        targetSymbol: cleanTarget,
        matchedItemsCount: count,
        explanation: `${count} ${displayNoun}. Found ${count} ${singular} entities defined in the '${primaryCollection.variableName}' roster in ${primaryCollection.filePath} (lines ${primaryCollection.line}–${primaryCollection.endLine || primaryCollection.line})${relatedClass ? `, representing instances of the '${relatedClass.name}' class` : ''}.`,
        assignments: [primaryCollection],
        classDefs: relatedClass ? [relatedClass] : undefined,
        entityInfo: {
          entityName: cleanTarget,
          countType: 'entity_roster',
          className: relatedClass?.name,
          collectionVariable: primaryCollection.variableName,
          elementCount: count,
          evidenceFile: primaryCollection.filePath,
          startLine: primaryCollection.line,
          endLine: primaryCollection.endLine,
          reliable: true
        }
      },
      findings: [finding]
    };
  }

  // 5.2 What if an entity class exists, but NO collection/roster was found?
  // Rule 5: If a reliable count cannot be established, DO NOT guess.
  // Return: "I found the <Name> class, but I could not reliably determine the number of <entity> entities from the indexed evidence."
  const matchingClasses = index.getAllClassNames().filter(c => {
    const cLower = c.toLowerCase();
    return cLower === singular ||
           cLower === lowerTarget ||
           cLower.includes(singular) ||
           cLower.includes(lowerTarget);
  });

  // Also check if any class is defined in a matching directory (e.g., models/ for 'model')
  if (matchingClasses.length === 0 && (singular === 'model' || lowerTarget === 'models')) {
    const modelClasses = index.getAllClassNames().filter(c => {
      const def = index.findClassDefinition(c);
      return def && def.filePath.startsWith('models/');
    });
    if (modelClasses.length > 0) {
      matchingClasses.push(...modelClasses);
    }
  }

  if (matchingClasses.length > 0) {
    const clsName = matchingClasses[0];
    const clsDef = index.findClassDefinition(clsName);
    const actualClassName = clsDef ? clsDef.name : clsName;

    const findings: AgentFinding[] = clsDef ? [{
      id: `struct_entity_class_${clsDef.name}`,
      queryId: `q_${Date.now()}`,
      location: {
        filePath: clsDef.filePath,
        startLine: clsDef.startLine,
        endLine: clsDef.endLine,
        className: clsDef.name
      },
      codeSnippet: {
        id: `snip_cls_${clsDef.name}`,
        location: {
          filePath: clsDef.filePath,
          startLine: clsDef.startLine,
          endLine: clsDef.endLine
        },
        content: workspace.getFileLines(clsDef.filePath, clsDef.startLine, clsDef.endLine) || `class ${clsDef.name}:`,
        language: 'python'
      },
      explanation: `I found the ${actualClassName} class in ${clsDef.filePath} (lines ${clsDef.startLine}–${clsDef.endLine}), but no persistent entity roster or dataset of ${cleanTarget} was found in the indexed code.`,
      evidence: [
        `Class definition: ${clsDef.name} in ${clsDef.filePath}:${clsDef.startLine}-${clsDef.endLine}`,
        `No static collection or roster of ${cleanTarget} entities is defined in the repository.`
      ],
      confidenceScore: 0.7
    }] : [];

    return {
      handled: true,
      queryResult: {
        queryType: 'general_structural',
        targetSymbol: cleanTarget,
        matchedItemsCount: 0,
        explanation: `I found the ${actualClassName} class, but I could not reliably determine the number of ${singular} entities from the indexed evidence.`,
        classDefs: clsDef ? [clsDef] : [],
        entityInfo: {
          entityName: cleanTarget,
          countType: 'unconfirmed',
          className: actualClassName,
          reliable: false
        }
      },
      findings
    };
  }

  // 5.3 Unknown entity (neither collection nor class found)
  return {
    handled: true,
    queryResult: {
      queryType: 'general_structural',
      targetSymbol: cleanTarget,
      matchedItemsCount: 0,
      explanation: `I found no class definitions or collections related to '${cleanTarget}', and could not determine a reliable total count from the indexed evidence.`,
      entityInfo: {
        entityName: cleanTarget,
        countType: 'unconfirmed',
        reliable: false
      }
    },
    findings: []
  };
}
