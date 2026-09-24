/**
 * JavaScript & TypeScript AST Structural Parser using @babel/parser
 * Supports .js, .jsx, .mjs, .cjs, and .ts/.tsx
 *
 * Extracts:
 * - Functions (declarations, expressions, arrows, async)
 * - Classes & Methods (constructors, methods, getters, setters)
 * - Imports (ES named, default, namespace, require())
 * - Exports (named, default, module.exports, exports.foo)
 * - Calls (function calls, method calls, constructors)
 * - References (symbol usages, identifiers)
 * - Exact 1-based startLine and endLine with exact columns
 */

import { parse as babelParse, type ParserPlugin } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type {
  SourceFileStructure,
  FunctionDefinition,
  MethodDefinition,
  ClassDefinition,
  CallSite,
  ImportReference,
  ExportReference,
  SymbolReference,
  AssignmentDefinition,
  ParameterInfo,
  CallConfidence
} from '../../types/structural.js';

// Workaround for Babel traverse CJS/ESM interop
// @ts-expect-error handling babel traverse default/named export
const traverse = traverseModule.default || traverseModule;

function getParserPlugins(filePath: string): ParserPlugin[] {
  const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  const isJsx = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
  
  const plugins: ParserPlugin[] = [
    'asyncGenerators',
    'bigInt',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'doExpressions',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'nullishCoalescingOperator',
    'numericSeparator',
    'objectRestSpread',
    'optionalCatchBinding',
    'optionalChaining',
    'topLevelAwait'
  ];

  if (isJsx) {
    plugins.push('jsx');
  }

  if (isTs) {
    plugins.push('typescript');
  }

  return plugins;
}

function extractJsParameters(params: any[]): { names: string[]; details: ParameterInfo[] } {
  const names: string[] = [];
  const details: ParameterInfo[] = [];

  for (const p of params) {
    if (!p) continue;
    if (p.type === 'Identifier') {
      const name = p.name;
      names.push(name);
      details.push({
        name,
        typeAnnotation: p.typeAnnotation?.typeAnnotation?.type,
        hasDefault: false
      });
    } else if (p.type === 'AssignmentPattern' && p.left?.type === 'Identifier') {
      const name = p.left.name;
      names.push(name);
      details.push({
        name,
        typeAnnotation: p.left.typeAnnotation?.typeAnnotation?.type,
        hasDefault: true
      });
    } else if (p.type === 'RestElement' && p.argument?.type === 'Identifier') {
      const name = `...${p.argument.name}`;
      names.push(name);
      details.push({
        name,
        hasDefault: false
      });
    } else if (p.type === 'ObjectPattern') {
      names.push('{...}');
      details.push({
        name: '{...}',
        hasDefault: false
      });
    } else if (p.type === 'ArrayPattern') {
      names.push('[...]');
      details.push({
        name: '[...]',
        hasDefault: false
      });
    }
  }

  return { names, details };
}

function extractCalleeName(calleeNode: any): { name: string; confidence: CallConfidence } {
  if (!calleeNode) return { name: '', confidence: 'unknown' };

  if (calleeNode.type === 'Identifier') {
    return { name: calleeNode.name, confidence: 'confirmed' };
  }

  if (calleeNode.type === 'MemberExpression') {
    if (calleeNode.computed) {
      // Dynamic property access like obj[fnName] or arr[0]
      const objName = calleeNode.object?.type === 'Identifier' ? calleeNode.object.name : 'obj';
      return { name: `${objName}[computed]`, confidence: 'unresolved' as any };
    }
    const propName = calleeNode.property?.type === 'Identifier' ? calleeNode.property.name : '';
    if (calleeNode.object?.type === 'Identifier') {
      return { name: `${calleeNode.object.name}.${propName}`, confidence: 'confirmed' };
    } else if (calleeNode.object?.type === 'ThisExpression') {
      return { name: `this.${propName}`, confidence: 'confirmed' };
    } else {
      return { name: propName || 'method', confidence: 'likely' };
    }
  }

  if (calleeNode.type === 'CallExpression') {
    // Chained call: e.g. foo().bar()
    const inner = extractCalleeName(calleeNode.callee);
    return { name: `${inner.name}()`, confidence: 'likely' };
  }

  return { name: 'anonymous', confidence: 'unknown' };
}

/**
 * Parses JavaScript or TypeScript source into SourceFileStructure using @babel/parser.
 */
export function parseJavaScriptSource(filePath: string, sourceText: string): SourceFileStructure {
  const lineCount = (sourceText.match(/\n/g) || []).length + 1;
  const moduleName = filePath.replace(/\.[^/.]+$/, '').replace(/\\/g, '/');

  const structure: SourceFileStructure = {
    filePath,
    moduleName,
    language: (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) ? 'typescript' : 'javascript',
    lineCount,
    imports: [],
    exports: [],
    classes: [],
    functions: [],
    methods: [],
    calls: [],
    references: [],
    assignments: [],
    parseStatus: 'success'
  };

  let ast: any;
  try {
    ast = babelParse(sourceText, {
      sourceType: 'unambiguous',
      plugins: getParserPlugins(filePath),
      tokens: false
    });
  } catch (err: any) {
    structure.parseStatus = 'error';
    structure.parseError = err?.message || 'Babel parse error';
    return structure;
  }

  // Helper to resolve enclosing function/method or class
  function getEnclosingScope(path: any): { caller: string; containingClass?: string } {
    let current = path.parentPath;
    let caller = '<top-level>';
    let containingClass: string | undefined;

    while (current) {
      const node = current.node;
      if (node.type === 'ClassDeclaration' && node.id?.name) {
        if (!containingClass) containingClass = node.id.name;
      }
      if (node.type === 'ClassMethod' && node.key?.name) {
        caller = node.key.name;
        break;
      }
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        caller = node.id.name;
        break;
      }
      if (
        (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') &&
        current.parentPath?.node?.type === 'VariableDeclarator' &&
        current.parentPath.node.id?.name
      ) {
        caller = current.parentPath.node.id.name;
        break;
      }
      current = current.parentPath;
    }

    return { caller, containingClass };
  }

  try {
    traverse(ast, {
      // 1. Function Declarations
      FunctionDeclaration(path: any) {
        const node = path.node;
        const name = node.id?.name || 'anonymous';
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;
        const startColumn = node.loc?.start?.column;
        const endColumn = node.loc?.end?.column;
        const { names, details } = extractJsParameters(node.params);

        const isExported = path.parentPath?.type === 'ExportNamedDeclaration' || path.parentPath?.type === 'ExportDefaultDeclaration';
        const isDefaultExport = path.parentPath?.type === 'ExportDefaultDeclaration';

        structure.functions.push({
          name,
          filePath,
          startLine,
          endLine,
          startColumn,
          endColumn,
          parameters: names,
          parameterDetails: details,
          decorators: [],
          isAsync: node.async || false,
          isArrow: false,
          isExported,
          isDefaultExport
        });

        structure.references.push({
          symbol: name,
          filePath,
          line: startLine,
          startLine,
          endLine,
          startColumn,
          endColumn,
          containingScope: name,
          contextKind: 'variable_usage',
          confidence: 'confirmed'
        });
      },

      // 2. Arrow Functions and Function Expressions assigned to variables
      VariableDeclarator(path: any) {
        const node = path.node;
        if (!node.id || node.id.type !== 'Identifier') return;
        const varName = node.id.name;
        const init = node.init;

        const isTopLevel = path.parentPath?.parentPath?.type === 'Program';

        if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          const startLine = init.loc?.start?.line || node.loc?.start?.line || 1;
          const endLine = init.loc?.end?.line || startLine;
          const startColumn = node.loc?.start?.column;
          const endColumn = init.loc?.end?.column;
          const { names, details } = extractJsParameters(init.params);

          const isExported = path.parentPath?.parentPath?.type === 'ExportNamedDeclaration';

          structure.functions.push({
            name: varName,
            filePath,
            startLine,
            endLine,
            startColumn,
            endColumn,
            parameters: names,
            parameterDetails: details,
            decorators: [],
            isAsync: init.async || false,
            isArrow: init.type === 'ArrowFunctionExpression',
            isExported,
            isDefaultExport: false
          });

          structure.references.push({
            symbol: varName,
            filePath,
            line: startLine,
            startLine,
            endLine,
            startColumn,
            endColumn,
            containingScope: varName,
            contextKind: 'variable_usage',
            confidence: 'confirmed'
          });
        } else if (isTopLevel && init) {
          // Regular variable assignment
          const startLine = node.loc?.start?.line || 1;
          const endLine = node.loc?.end?.line || startLine;
          let valType: AssignmentDefinition['valueType'] = 'primitive';
          let elementCount: number | undefined;

          if (init.type === 'ArrayExpression') {
            valType = 'array';
            elementCount = init.elements?.length;
          } else if (init.type === 'ObjectExpression') {
            valType = 'object';
            elementCount = init.properties?.length;
          } else if (init.type === 'CallExpression') {
            valType = 'call';
          }

          structure.assignments.push({
            variableName: varName,
            filePath,
            line: startLine,
            startLine,
            endLine,
            isModuleLevel: true,
            valueType: valType,
            elementCount
          });
        }
      },

      // 3. Class Declarations
      ClassDeclaration(path: any) {
        const node = path.node;
        const className = node.id?.name || 'AnonymousClass';
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;
        const startColumn = node.loc?.start?.column;
        const endColumn = node.loc?.end?.column;

        const baseClasses: string[] = [];
        if (node.superClass) {
          if (node.superClass.type === 'Identifier') {
            baseClasses.push(node.superClass.name);
          } else if (node.superClass.type === 'MemberExpression') {
            const baseObj = node.superClass.object?.name || '';
            const baseProp = node.superClass.property?.name || '';
            baseClasses.push(baseObj ? `${baseObj}.${baseProp}` : baseProp);
          }
        }

        const methodNames: string[] = [];
        if (node.body?.body) {
          for (const member of node.body.body) {
            if (member.type === 'ClassMethod' || member.type === 'ClassProperty') {
              const mName = member.key?.name;
              if (mName) methodNames.push(mName);
            }
          }
        }

        const isExported = path.parentPath?.type === 'ExportNamedDeclaration' || path.parentPath?.type === 'ExportDefaultDeclaration';
        const isDefaultExport = path.parentPath?.type === 'ExportDefaultDeclaration';

        structure.classes.push({
          name: className,
          filePath,
          startLine,
          endLine,
          startColumn,
          endColumn,
          baseClasses,
          methods: methodNames,
          isExported,
          isDefaultExport
        });

        // References
        structure.references.push({
          symbol: className,
          filePath,
          line: startLine,
          startLine,
          endLine,
          contextKind: 'variable_usage',
          confidence: 'confirmed'
        });

        for (const base of baseClasses) {
          structure.references.push({
            symbol: base,
            filePath,
            line: startLine,
            startLine,
            endLine,
            contextKind: 'base_class',
            confidence: 'confirmed'
          });
        }
      },

      // 4. Class Methods
      ClassMethod(path: any) {
        const node = path.node;
        const methodName = node.key?.name || (node.kind === 'constructor' ? 'constructor' : 'method');
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;
        const startColumn = node.loc?.start?.column;
        const endColumn = node.loc?.end?.column;
        const { names, details } = extractJsParameters(node.params);

        const classParent = path.findParent((p: any) => p.isClassDeclaration());
        const className = classParent?.node?.id?.name || 'Class';

        structure.methods.push({
          name: methodName,
          className,
          filePath,
          startLine,
          endLine,
          startColumn,
          endColumn,
          parameters: names,
          parameterDetails: details,
          decorators: [],
          isAsync: node.async || false,
          isStatic: node.static || false,
          isConstructor: node.kind === 'constructor',
          kind: node.kind
        });

        structure.references.push({
          symbol: `${className}.${methodName}`,
          filePath,
          line: startLine,
          startLine,
          endLine,
          contextKind: 'variable_usage',
          confidence: 'confirmed'
        });
      },

      // 5. Imports (ES Import Declarations)
      ImportDeclaration(path: any) {
        const node = path.node;
        const sourceModule = node.source?.value || '';
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;

        for (const spec of node.specifiers) {
          let importedName = '';
          let alias: string | undefined;
          let importType: ImportReference['importType'] = 'es_named';

          if (spec.type === 'ImportSpecifier') {
            importedName = spec.imported?.type === 'Identifier' ? spec.imported.name : (spec.imported?.value || '');
            if (spec.local?.name && spec.local.name !== importedName) {
              alias = spec.local.name;
            }
            importType = 'es_named';
          } else if (spec.type === 'ImportDefaultSpecifier') {
            importedName = 'default';
            alias = spec.local?.name;
            importType = 'es_default';
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            importedName = '*';
            alias = spec.local?.name;
            importType = 'es_namespace';
          }

          structure.imports.push({
            sourceModule,
            importedName,
            alias,
            filePath,
            line: startLine,
            startLine,
            endLine,
            isFromImport: true,
            importType
          });

          structure.references.push({
            symbol: alias || importedName,
            filePath,
            line: startLine,
            startLine,
            endLine,
            contextKind: 'import',
            confidence: 'confirmed'
          });
        }
      },

      // 6. CommonJS require() calls and exports
      CallExpression(path: any) {
        const node = path.node;
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;
        const startColumn = node.loc?.start?.column;
        const endColumn = node.loc?.end?.column;

        // Check if this is require('./foo')
        if (node.callee?.type === 'Identifier' && node.callee.name === 'require') {
          const arg = node.arguments?.[0];
          if (arg && (arg.type === 'StringLiteral' || arg.type === 'Literal')) {
            const sourceModule = arg.value;
            // Check if destructured: const { foo, bar } = require(...)
            const parentDeclarator = path.parentPath?.type === 'VariableDeclarator' ? path.parentPath.node : null;
            if (parentDeclarator?.id?.type === 'ObjectPattern') {
              for (const prop of parentDeclarator.id.properties) {
                if (prop.type === 'ObjectProperty' && prop.key?.name) {
                  structure.imports.push({
                    sourceModule,
                    importedName: prop.key.name,
                    alias: prop.value?.name !== prop.key.name ? prop.value?.name : undefined,
                    filePath,
                    line: startLine,
                    startLine,
                    endLine,
                    isFromImport: true,
                    importType: 'commonjs_require'
                  });
                }
              }
            } else {
              const localName = parentDeclarator?.id?.name || sourceModule;
              structure.imports.push({
                sourceModule,
                importedName: localName,
                filePath,
                line: startLine,
                startLine,
                endLine,
                isFromImport: false,
                importType: 'commonjs_require'
              });
            }
            return;
          }
        }

        // Standard function/method call
        const { caller, containingClass } = getEnclosingScope(path);
        const { name: calleeName, confidence } = extractCalleeName(node.callee);

        if (calleeName) {
          structure.calls.push({
            caller,
            callee: calleeName,
            filePath,
            line: startLine,
            startLine,
            endLine,
            startColumn,
            endColumn,
            confidence,
            containingClass,
            argumentsCount: node.arguments?.length || 0
          });

          structure.references.push({
            symbol: calleeName,
            filePath,
            line: startLine,
            startLine,
            endLine,
            containingScope: caller,
            contextKind: 'call',
            confidence
          });
        }
      },

      // 7. Constructor calls: new Class(...)
      NewExpression(path: any) {
        const node = path.node;
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;
        const { caller, containingClass } = getEnclosingScope(path);
        const { name: calleeName, confidence } = extractCalleeName(node.callee);

        if (calleeName) {
          structure.calls.push({
            caller,
            callee: calleeName,
            filePath,
            line: startLine,
            startLine,
            endLine,
            confidence,
            containingClass,
            isConstructorCall: true,
            argumentsCount: node.arguments?.length || 0
          });

          structure.references.push({
            symbol: calleeName,
            filePath,
            line: startLine,
            startLine,
            endLine,
            containingScope: caller,
            contextKind: 'call',
            confidence
          });
        }
      },

      // 8. ES Exports
      ExportNamedDeclaration(path: any) {
        const node = path.node;
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;

        if (node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id?.name) {
            structure.exports.push({
              exportedName: node.declaration.id.name,
              filePath,
              line: startLine,
              startLine,
              endLine,
              exportType: 'named'
            });
          } else if (node.declaration.type === 'ClassDeclaration' && node.declaration.id?.name) {
            structure.exports.push({
              exportedName: node.declaration.id.name,
              filePath,
              line: startLine,
              startLine,
              endLine,
              exportType: 'named'
            });
          } else if (node.declaration.type === 'VariableDeclaration') {
            for (const decl of node.declaration.declarations) {
              if (decl.id?.type === 'Identifier') {
                structure.exports.push({
                  exportedName: decl.id.name,
                  filePath,
                  line: startLine,
                  startLine,
                  endLine,
                  exportType: 'named'
                });
              }
            }
          }
        }

        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.type === 'ExportSpecifier') {
              const exportedName = spec.exported?.type === 'Identifier' ? spec.exported.name : spec.exported?.value;
              const localName = spec.local?.name;
              structure.exports.push({
                exportedName: exportedName || localName,
                localName,
                filePath,
                line: startLine,
                startLine,
                endLine,
                exportType: 'named'
              });
            }
          }
        }
      },

      ExportDefaultDeclaration(path: any) {
        const node = path.node;
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;
        let localName: string | undefined;

        if (node.declaration?.id?.name) {
          localName = node.declaration.id.name;
        } else if (node.declaration?.type === 'Identifier') {
          localName = node.declaration.name;
        }

        structure.exports.push({
          exportedName: 'default',
          localName,
          filePath,
          line: startLine,
          startLine,
          endLine,
          exportType: 'default'
        });
      },

      // 9. CommonJS module.exports = ... and exports.foo = ...
      AssignmentExpression(path: any) {
        const node = path.node;
        const startLine = node.loc?.start?.line || 1;
        const endLine = node.loc?.end?.line || startLine;

        if (node.left?.type === 'MemberExpression') {
          // module.exports = ...
          if (
            node.left.object?.type === 'Identifier' &&
            node.left.object.name === 'module' &&
            node.left.property?.type === 'Identifier' &&
            node.left.property.name === 'exports'
          ) {
            if (node.right?.type === 'ObjectExpression') {
              for (const prop of node.right.properties) {
                if (prop.type === 'ObjectProperty' && prop.key?.name) {
                  structure.exports.push({
                    exportedName: prop.key.name,
                    localName: prop.value?.name,
                    filePath,
                    line: startLine,
                    startLine,
                    endLine,
                    exportType: 'commonjs_module_exports'
                  });
                }
              }
            } else {
              const localName = node.right?.type === 'Identifier' ? node.right.name : undefined;
              structure.exports.push({
                exportedName: 'default',
                localName,
                filePath,
                line: startLine,
                startLine,
                endLine,
                exportType: 'commonjs_module_exports'
              });
            }
          }
          // exports.foo = ...
          else if (
            node.left.object?.type === 'Identifier' &&
            node.left.object.name === 'exports' &&
            node.left.property?.type === 'Identifier'
          ) {
            const expName = node.left.property.name;
            const localName = node.right?.type === 'Identifier' ? node.right.name : undefined;
            structure.exports.push({
              exportedName: expName,
              localName,
              filePath,
              line: startLine,
              startLine,
              endLine,
              exportType: 'commonjs_exports'
            });
          }
        }
      }
    });
  } catch (err: any) {
    structure.parseStatus = 'warning';
    structure.parseError = err?.message || 'Babel AST traversal warning';
  }

  return structure;
}
