import { parse } from 'py-ast';
import type { 
  PythonFileStructure, 
  FunctionDefinition, 
  MethodDefinition, 
  ClassDefinition, 
  CallSite, 
  ImportReference, 
  SymbolReference, 
  AssignmentDefinition,
  ParameterInfo
} from '../../types/structural.js';

// Helper to extract identifier or string representation of an AST expression
function formatExpression(node: any): string {
  if (!node) return '';
  switch (node.nodeType) {
    case 'Name':
      return node.id || '';
    case 'Attribute':
      return `${formatExpression(node.value)}.${node.attr || ''}`;
    case 'Constant':
      return String(node.value);
    case 'Subscript':
      return `${formatExpression(node.value)}[${formatExpression(node.slice)}]`;
    case 'Call':
      return `${formatExpression(node.func)}()`;
    default:
      return node.id || node.name || node.attr || '';
  }
}

function extractDocstring(body: any[]): string | undefined {
  if (body && body.length > 0) {
    const first = body[0];
    if (first.nodeType === 'Expr' && first.value?.nodeType === 'Constant' && typeof first.value.value === 'string') {
      return first.value.value.trim();
    }
  }
  return undefined;
}

function extractDecoratorNames(decoratorList: any[]): string[] {
  if (!decoratorList) return [];
  return decoratorList.map(d => {
    if (d.nodeType === 'Name') return d.id;
    if (d.nodeType === 'Attribute') return `${formatExpression(d.value)}.${d.attr}`;
    if (d.nodeType === 'Call') return formatExpression(d.func);
    return formatExpression(d);
  }).filter(Boolean);
}

function extractParameters(argsNode: any): { names: string[]; details: ParameterInfo[] } {
  if (!argsNode || !argsNode.args) {
    return { names: [], details: [] };
  }

  const names: string[] = [];
  const details: ParameterInfo[] = [];
  const defaultsCount = argsNode.defaults ? argsNode.defaults.length : 0;
  const numArgs = argsNode.args.length;
  const defaultStartIndex = numArgs - defaultsCount;

  argsNode.args.forEach((arg: any, index: number) => {
    const name = arg.arg;
    names.push(name);
    details.push({
      name,
      typeAnnotation: arg.annotation ? formatExpression(arg.annotation) : undefined,
      hasDefault: index >= defaultStartIndex
    });
  });

  return { names, details };
}

function analyzeAssignmentValue(valueNode: any): {
  valueType: 'list' | 'dict' | 'set' | 'tuple' | 'call' | 'primitive' | 'other';
  elementCount?: number;
  valueSummary?: string;
  elements?: string[];
} {
  if (!valueNode) return { valueType: 'other' };

  if (valueNode.nodeType === 'List' && Array.isArray(valueNode.elts)) {
    return {
      valueType: 'list',
      elementCount: valueNode.elts.length,
      valueSummary: `List with ${valueNode.elts.length} elements`,
      elements: valueNode.elts.map((elt: any) => formatExpression(elt))
    };
  }

  if (valueNode.nodeType === 'Dict' && Array.isArray(valueNode.keys)) {
    return {
      valueType: 'dict',
      elementCount: valueNode.keys.length,
      valueSummary: `Dict with ${valueNode.keys.length} entries`
    };
  }

  if (valueNode.nodeType === 'Set' && Array.isArray(valueNode.elts)) {
    return {
      valueType: 'set',
      elementCount: valueNode.elts.length,
      valueSummary: `Set with ${valueNode.elts.length} elements`
    };
  }

  if (valueNode.nodeType === 'Tuple' && Array.isArray(valueNode.elts)) {
    return {
      valueType: 'tuple',
      elementCount: valueNode.elts.length,
      valueSummary: `Tuple with ${valueNode.elts.length} elements`
    };
  }

  if (valueNode.nodeType === 'Call') {
    return {
      valueType: 'call',
      valueSummary: `Call to ${formatExpression(valueNode.func)}()`
    };
  }

  if (valueNode.nodeType === 'Constant') {
    return {
      valueType: 'primitive',
      valueSummary: String(valueNode.value)
    };
  }

  return {
    valueType: 'other',
    valueSummary: formatExpression(valueNode)
  };
}

/**
 * Parses Python source text into a PythonFileStructure using py-ast (true CPython-compatible AST).
 * Any syntax error or malformed code is safely caught and recorded without throwing.
 */
export function parsePythonSource(filePath: string, sourceText: string): PythonFileStructure {
  const lineCount = sourceText.split('\n').length;
  const moduleName = filePath.replace(/\.py$/i, '').replace(/\//g, '.');

  const imports: ImportReference[] = [];
  const classes: ClassDefinition[] = [];
  const functions: FunctionDefinition[] = [];
  const methods: MethodDefinition[] = [];
  const calls: CallSite[] = [];
  const references: SymbolReference[] = [];
  const assignments: AssignmentDefinition[] = [];

  let astRoot: any;
  try {
    astRoot = parse(sourceText);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      filePath,
      moduleName,
      language: 'python',
      lineCount,
      imports: [],
      exports: [],
      classes: [],
      functions: [],
      methods: [],
      calls: [],
      references: [],
      assignments: [],
      parseStatus: 'error',
      parseError: errorMsg
    };
  }

  // Known symbols in this file for confidence estimation
  const locallyDefinedSymbols = new Set<string>();
  const importedSymbols = new Set<string>();

  // Scope tracking during AST traversal
  interface ScopeContext {
    currentClass?: string;
    currentFunction?: string;
    isModuleLevel: boolean;
  }

  function walkNode(node: any, scope: ScopeContext) {
    if (!node || typeof node !== 'object') return;

    switch (node.nodeType) {
      // 1. Import statements: `import os`, `import math as m`
      case 'Import': {
        if (node.names && Array.isArray(node.names)) {
          for (const alias of node.names) {
            const modName = alias.name || '';
            const asname = alias.asname || undefined;
            const line = alias.lineno || node.lineno || 1;
            imports.push({
              sourceModule: modName,
              importedName: modName,
              alias: asname,
              filePath,
              line,
              isFromImport: false
            });
            importedSymbols.add(asname || modName);
            references.push({
              symbol: modName,
              filePath,
              line,
              containingScope: scope.currentFunction || scope.currentClass || '<module>',
              contextKind: 'import'
            });
          }
        }
        break;
      }

      // 2. From Import statements: `from auth.login import validate_token as v_tok`
      case 'ImportFrom': {
        const modName = node.module || '';
        if (node.names && Array.isArray(node.names)) {
          for (const alias of node.names) {
            const impName = alias.name || '';
            const asname = alias.asname || undefined;
            const line = alias.lineno || node.lineno || 1;
            imports.push({
              sourceModule: modName,
              importedName: impName,
              alias: asname,
              filePath,
              line,
              isFromImport: true
            });
            importedSymbols.add(asname || impName);
            references.push({
              symbol: impName,
              filePath,
              line,
              containingScope: scope.currentFunction || scope.currentClass || '<module>',
              contextKind: 'import'
            });
          }
        }
        break;
      }

      // 3. Class definitions: `class User(BaseModel):`
      case 'ClassDef': {
        const className = node.name;
        const startLine = node.lineno || 1;
        const endLine = node.end_lineno || startLine;
        const baseClasses: string[] = (node.bases || []).map(formatExpression).filter(Boolean);
        const methodNames: string[] = [];

        locallyDefinedSymbols.add(className);

        // Record base class references
        for (const base of baseClasses) {
          references.push({
            symbol: base,
            filePath,
            line: startLine,
            containingScope: className,
            contextKind: 'base_class'
          });
        }

        const classDoc = extractDocstring(node.body);

        // First pass through class body to register methods
        if (Array.isArray(node.body)) {
          for (const item of node.body) {
            if (item.nodeType === 'FunctionDef' || item.nodeType === 'AsyncFunctionDef') {
              methodNames.push(item.name);
            }
          }
        }

        classes.push({
          name: className,
          filePath,
          startLine,
          endLine,
          baseClasses,
          methods: methodNames,
          docstring: classDoc
        });

        // Traverse class body with class scope
        if (Array.isArray(node.body)) {
          for (const item of node.body) {
            walkNode(item, {
              currentClass: className,
              currentFunction: undefined,
              isModuleLevel: false
            });
          }
        }
        return; // Already walked children
      }

      // 4. Function definitions: `def login_user(username: str):` or `async def handle():`
      case 'FunctionDef':
      case 'AsyncFunctionDef': {
        const fnName = node.name;
        const startLine = node.lineno || 1;
        const endLine = node.end_lineno || startLine;
        const isAsync = node.nodeType === 'AsyncFunctionDef';
        const decorators = extractDecoratorNames(node.decorator_list);
        const { names: paramNames, details: paramDetails } = extractParameters(node.args);
        const fnDoc = extractDocstring(node.body);

        locallyDefinedSymbols.add(fnName);

        if (scope.currentClass) {
          // Method inside class
          const isStatic = decorators.includes('staticmethod');
          const isClassMethod = decorators.includes('classmethod');

          methods.push({
            name: fnName,
            filePath,
            startLine,
            endLine,
            parameters: paramNames,
            parameterDetails: paramDetails,
            decorators,
            isAsync,
            className: scope.currentClass,
            docstring: fnDoc,
            isStatic,
            isClassMethod
          });
        } else {
          // Top-level / nested function
          functions.push({
            name: fnName,
            filePath,
            startLine,
            endLine,
            parameters: paramNames,
            parameterDetails: paramDetails,
            decorators,
            isAsync,
            className: undefined,
            docstring: fnDoc
          });
        }

        // Traverse function body
        const qualifiedScopeName = scope.currentClass 
          ? `${scope.currentClass}.${fnName}`
          : fnName;

        if (Array.isArray(node.body)) {
          for (const item of node.body) {
            walkNode(item, {
              currentClass: scope.currentClass,
              currentFunction: qualifiedScopeName,
              isModuleLevel: false
            });
          }
        }
        return; // Already walked children
      }

      // 5. Function calls: `validate_token(t)` or `auth.login(user)`
      case 'Call': {
        const calleeSymbol = formatExpression(node.func);
        const line = node.lineno || 1;
        const caller = scope.currentFunction || (scope.currentClass ? `${scope.currentClass}.<class>` : '<module>');

        if (calleeSymbol) {
          // Determine confidence statically
          // If the base symbol is imported or locally defined, it is confirmed
          const baseSymbol = calleeSymbol.split('.')[0];
          let confidence: 'confirmed' | 'likely' | 'unknown' = 'unknown';

          if (locallyDefinedSymbols.has(baseSymbol) || importedSymbols.has(baseSymbol)) {
            confidence = 'confirmed';
          } else if (calleeSymbol.startsWith('self.') || calleeSymbol.startsWith('cls.')) {
            confidence = 'likely';
          } else if (['print', 'len', 'isinstance', 'enumerate', 'range', 'dict', 'list', 'set', 'str', 'int', 'float', 'bool', 'open', 'super'].includes(calleeSymbol)) {
            confidence = 'confirmed';
          } else {
            confidence = 'likely';
          }

          calls.push({
            caller,
            callee: calleeSymbol,
            filePath,
            line,
            confidence,
            containingClass: scope.currentClass
          });

          references.push({
            symbol: calleeSymbol,
            filePath,
            line,
            containingScope: caller,
            contextKind: 'call'
          });
        }
        break;
      }

      // 6. Variable assignments: `CONFIG = {'debug': True}`
      case 'Assign': {
        const line = node.lineno || 1;
        const endLine = node.end_lineno || line;
        const valAnalysis = analyzeAssignmentValue(node.value);

        if (node.targets && Array.isArray(node.targets)) {
          for (const target of node.targets) {
            const varName = formatExpression(target);
            if (varName && !varName.includes('.')) {
              if (scope.isModuleLevel) {
                locallyDefinedSymbols.add(varName);
              }
              assignments.push({
                variableName: varName,
                filePath,
                line,
                endLine,
                isModuleLevel: scope.isModuleLevel,
                valueType: valAnalysis.valueType,
                elementCount: valAnalysis.elementCount,
                valueSummary: valAnalysis.valueSummary,
                elements: valAnalysis.elements
              });
            }
          }
        }
        break;
      }

      case 'AnnAssign': {
        const line = node.lineno || 1;
        const endLine = node.end_lineno || line;
        const valAnalysis = analyzeAssignmentValue(node.value);
        const annotationStr = node.annotation ? formatExpression(node.annotation) : undefined;

        if (node.target) {
          const varName = formatExpression(node.target);
          if (varName && !varName.includes('.')) {
            if (scope.isModuleLevel) {
              locallyDefinedSymbols.add(varName);
            }
            assignments.push({
              variableName: varName,
              filePath,
              line,
              endLine,
              isModuleLevel: scope.isModuleLevel,
              valueType: valAnalysis.valueType,
              elementCount: valAnalysis.elementCount,
              valueSummary: valAnalysis.valueSummary,
              elements: valAnalysis.elements,
              typeAnnotation: annotationStr
            });
          }
        }
        break;
      }

      // 7. Generic identifier references
      case 'Name': {
        if (node.id && node.ctx?.nodeType === 'Load') {
          references.push({
            symbol: node.id,
            filePath,
            line: node.lineno || 1,
            containingScope: scope.currentFunction || scope.currentClass || '<module>',
            contextKind: 'variable_usage'
          });
        }
        break;
      }
    }

    // Recursively traverse child AST fields (including body of If, For, While, Try, etc.)
    for (const key of Object.keys(node)) {
      if (key === 'decorator_list' || key === 'args') continue; // Handled specially above
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.nodeType) {
            walkNode(item, scope);
          }
        }
      } else if (child && typeof child === 'object' && child.nodeType) {
        walkNode(child, scope);
      }
    }
  }

  // Walk root AST statements
  if (Array.isArray(astRoot.body)) {
    for (const statement of astRoot.body) {
      walkNode(statement, {
        currentClass: undefined,
        currentFunction: undefined,
        isModuleLevel: true
      });
    }
  }

  return {
    filePath,
    moduleName,
    language: 'python',
    lineCount,
    imports,
    exports: [],
    classes,
    functions,
    methods,
    calls,
    references,
    assignments,
    parseStatus: 'success'
  };
}
