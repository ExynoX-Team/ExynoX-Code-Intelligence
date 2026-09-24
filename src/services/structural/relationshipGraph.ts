/**
 * ExynoX Unified Relationship & Call Graph Engine
 * Samsung PRISM GenAI Hackathon (Theme 1: Agentic Code Intelligence)
 *
 * Internal relationship graph capturing:
 * - Nodes: Files, Modules, Classes, Functions, Methods, Variables
 * - Edges: CALLS, IMPORTS, EXPORTS, REFERENCES, INHERITS, DEFINES, CONTAINS
 *
 * Provides deterministic BFS call-chain discovery and structural traversal
 * across JavaScript (primary), TypeScript, and Python.
 */

import type { 
  SourceFileStructure, 
  RelationshipNode, 
  RelationshipEdge, 
  CallChainResult, 
  CallChainStep,
  CallSite
} from '../../types/structural.js';

export class RelationshipGraph {
  private nodes: Map<string, RelationshipNode> = new Map();
  private edges: RelationshipEdge[] = [];
  
  // Adjacency maps for fast graph traversal
  private outgoingCalls: Map<string, RelationshipEdge[]> = new Map();
  private incomingCalls: Map<string, RelationshipEdge[]> = new Map();
  private symbolToNodeIds: Map<string, Set<string>> = new Map();

  /**
   * Resets and populates the graph from parsed AST structures (JavaScript, TypeScript, Python).
   */
  public buildGraph(fileStructures: SourceFileStructure[]): void {
    this.clear();

    for (const file of fileStructures) {
      const fileNodeId = `file:${file.filePath}`;
      this.addNode({
        id: fileNodeId,
        kind: 'file',
        name: file.filePath,
        filePath: file.filePath,
        language: file.language,
        line: 1,
        endLine: file.lineCount
      });

      // 1. Classes & Methods
      for (const cls of file.classes) {
        const classNodeId = `class:${cls.name}:${file.filePath}`;
        this.addNode({
          id: classNodeId,
          kind: 'class',
          name: cls.name,
          filePath: file.filePath,
          language: file.language,
          line: cls.startLine,
          endLine: cls.endLine
        });

        this.addEdge({
          id: `def:${fileNodeId}->${classNodeId}`,
          sourceId: fileNodeId,
          targetId: classNodeId,
          kind: 'DEFINES',
          filePath: file.filePath,
          line: cls.startLine,
          confidence: 'confirmed'
        });

        // Inheritance
        for (const base of cls.baseClasses) {
          this.addEdge({
            id: `inherit:${classNodeId}->${base}`,
            sourceId: classNodeId,
            targetId: `symbol:${base}`,
            kind: 'INHERITS',
            filePath: file.filePath,
            line: cls.startLine,
            confidence: 'confirmed',
            details: base
          });
        }
      }

      for (const method of file.methods) {
        const methodNodeId = `method:${method.className}.${method.name}:${file.filePath}`;
        this.addNode({
          id: methodNodeId,
          kind: 'method',
          name: `${method.className}.${method.name}`,
          filePath: file.filePath,
          language: file.language,
          line: method.startLine,
          endLine: method.endLine
        });

        const classNodeId = `class:${method.className}:${file.filePath}`;
        this.addEdge({
          id: `contains:${classNodeId}->${methodNodeId}`,
          sourceId: classNodeId,
          targetId: methodNodeId,
          kind: 'CONTAINS',
          filePath: file.filePath,
          line: method.startLine,
          confidence: 'confirmed'
        });
      }

      // 2. Functions (Declarations, Arrow functions, Expressions)
      for (const fn of file.functions) {
        const fnNodeId = `fn:${fn.name}:${file.filePath}`;
        this.addNode({
          id: fnNodeId,
          kind: 'function',
          name: fn.name,
          filePath: file.filePath,
          language: file.language,
          line: fn.startLine,
          endLine: fn.endLine
        });

        this.addEdge({
          id: `def:${fileNodeId}->${fnNodeId}`,
          sourceId: fileNodeId,
          targetId: fnNodeId,
          kind: 'DEFINES',
          filePath: file.filePath,
          line: fn.startLine,
          confidence: 'confirmed'
        });
      }

      // 3. Imports
      for (const imp of file.imports) {
        this.addEdge({
          id: `import:${fileNodeId}->${imp.sourceModule}.${imp.importedName}:${imp.line}`,
          sourceId: fileNodeId,
          targetId: `symbol:${imp.importedName}`,
          kind: 'IMPORTS',
          filePath: file.filePath,
          line: imp.line,
          confidence: 'confirmed',
          details: imp.alias ? `${imp.importedName} as ${imp.alias}` : imp.importedName
        });
      }

      // 4. Exports
      for (const exp of file.exports || []) {
        this.addEdge({
          id: `export:${fileNodeId}->${exp.exportedName}:${exp.line}`,
          sourceId: fileNodeId,
          targetId: `symbol:${exp.exportedName}`,
          kind: 'EXPORTS',
          filePath: file.filePath,
          line: exp.line,
          confidence: 'confirmed',
          details: exp.localName ? `${exp.localName} as ${exp.exportedName}` : exp.exportedName
        });
      }

      // 5. Calls
      for (const call of file.calls) {
        const callerNodeId = this.resolveCallerNodeId(call, file.filePath);
        const calleeNodeId = `call_target:${call.callee}`;

        const edge: RelationshipEdge = {
          id: `call:${callerNodeId}->${call.callee}:${call.line}`,
          sourceId: callerNodeId,
          targetId: calleeNodeId,
          kind: 'CALLS',
          filePath: file.filePath,
          line: call.line,
          confidence: call.confidence,
          details: call.callee
        };

        this.addEdge(edge);
      }
    }
  }

  public clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.outgoingCalls.clear();
    this.incomingCalls.clear();
    this.symbolToNodeIds.clear();
  }

  private addNode(node: RelationshipNode): void {
    this.nodes.set(node.id, node);
    const lowerName = node.name.toLowerCase();
    if (!this.symbolToNodeIds.has(lowerName)) {
      this.symbolToNodeIds.set(lowerName, new Set());
    }
    this.symbolToNodeIds.get(lowerName)!.add(node.id);

    // Also register terminal name if qualified (e.g. Class.method -> method)
    if (node.name.includes('.')) {
      const parts = node.name.split('.');
      const terminal = parts[parts.length - 1].toLowerCase();
      if (!this.symbolToNodeIds.has(terminal)) {
        this.symbolToNodeIds.set(terminal, new Set());
      }
      this.symbolToNodeIds.get(terminal)!.add(node.id);
    }
  }

  private addEdge(edge: RelationshipEdge): void {
    this.edges.push(edge);
    if (edge.kind === 'CALLS') {
      if (!this.outgoingCalls.has(edge.sourceId)) {
        this.outgoingCalls.set(edge.sourceId, []);
      }
      this.outgoingCalls.get(edge.sourceId)!.push(edge);

      const targetKey = edge.details?.toLowerCase() || edge.targetId.toLowerCase();
      if (!this.incomingCalls.has(targetKey)) {
        this.incomingCalls.set(targetKey, []);
      }
      this.incomingCalls.get(targetKey)!.push(edge);
    }
  }

  private resolveCallerNodeId(call: CallSite, filePath: string): string {
    if (call.containingClass) {
      return `method:${call.containingClass}.${call.caller}:${filePath}`;
    }
    if (call.caller && call.caller !== '<module>' && call.caller !== '<top-level>') {
      return `fn:${call.caller}:${filePath}`;
    }
    return `file:${filePath}`;
  }

  /**
   * Finds the shortest confirmed call chain between two symbols using breadth-first search.
   * Resolves aliases, method calls, and qualified names.
   * Limits traversal depth to 8 to prevent cycles or combinatorial explosion.
   */
  public findCallChain(
    fromSymbol: string, 
    toSymbol: string, 
    workspaceSnippetResolver?: (filePath: string, startLine: number, endLine: number) => string
  ): CallChainResult {
    const cleanFrom = fromSymbol.trim();
    const cleanTo = toSymbol.trim();
    const fromLower = cleanFrom.toLowerCase();
    const toLower = cleanTo.toLowerCase();

    // 1. Resolve start node IDs
    const startNodeIds = this.resolveSymbolNodes(fromLower);
    if (startNodeIds.length === 0) {
      return {
        fromSymbol: cleanFrom,
        toSymbol: cleanTo,
        steps: [],
        pathFound: false,
        explanation: `Could not verify starting symbol '${cleanFrom}' in the indexed repository.`
      };
    }

    // 2. BFS state queue
    interface BFSQueueItem {
      currentNodeId: string;
      currentSymbolName: string;
      steps: CallChainStep[];
      visited: Set<string>;
    }

    const queue: BFSQueueItem[] = [];
    for (const startId of startNodeIds) {
      const node = this.nodes.get(startId);
      const name = node ? node.name : cleanFrom;
      const visited = new Set<string>([startId]);
      queue.push({
        currentNodeId: startId,
        currentSymbolName: name,
        steps: [],
        visited
      });
    }

    let foundSteps: CallChainStep[] | null = null;
    const MAX_DEPTH = 8;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.steps.length >= MAX_DEPTH) continue;

      const outgoing = this.outgoingCalls.get(current.currentNodeId) || [];

      for (const edge of outgoing) {
        const calleeRaw = edge.details || '';
        const calleeLower = calleeRaw.toLowerCase();
        const calleeTerminal = calleeLower.split('.').pop() || calleeLower;

        // Check if this edge reaches the target symbol
        const toTerminal = toLower.split('.').pop() || toLower;
        const matchesTarget = (
          calleeLower === toLower ||
          calleeTerminal === toLower ||
          calleeTerminal === toTerminal ||
          (toLower.includes('.') && calleeLower.endsWith(toLower)) ||
          calleeLower.endsWith(`.${toLower}`)
        );

        const snippet = workspaceSnippetResolver 
          ? workspaceSnippetResolver(edge.filePath, edge.line, edge.line)
          : `${current.currentSymbolName}() -> ${calleeRaw}()`;

        const step: CallChainStep = {
          stepIndex: current.steps.length + 1,
          fromSymbol: current.currentSymbolName,
          toSymbol: calleeRaw,
          filePath: edge.filePath,
          line: edge.line,
          snippet,
          confidence: edge.confidence === 'unknown' ? 'likely' : edge.confidence
        };

        const newSteps = [...current.steps, step];

        if (matchesTarget) {
          foundSteps = newSteps;
          break;
        }

        // Otherwise resolve next hop target nodes
        const nextTargetNodes = this.resolveCalleeToNodeIds(calleeLower, calleeTerminal);
        for (const nextNodeId of nextTargetNodes) {
          if (!current.visited.has(nextNodeId)) {
            const nextNode = this.nodes.get(nextNodeId);
            const nextName = nextNode ? nextNode.name : calleeRaw;
            const newVisited = new Set(current.visited);
            newVisited.add(nextNodeId);

            queue.push({
              currentNodeId: nextNodeId,
              currentSymbolName: nextName,
              steps: newSteps,
              visited: newVisited
            });
          }
        }
      }

      if (foundSteps) break;
    }

    if (foundSteps && foundSteps.length > 0) {
      const formattedChain = foundSteps.map(s => 
        `Step ${s.stepIndex}: '${s.fromSymbol}' calls '${s.toSymbol}' (${s.filePath}:${s.line})`
      ).join(' → ');

      return {
        fromSymbol: cleanFrom,
        toSymbol: cleanTo,
        steps: foundSteps,
        pathFound: true,
        explanation: `Verified call chain from '${cleanFrom}' to '${cleanTo}' (${foundSteps.length} hops): ${formattedChain}`
      };
    }

    return {
      fromSymbol: cleanFrom,
      toSymbol: cleanTo,
      steps: [],
      pathFound: false,
      explanation: `Could not verify a call chain between '${cleanFrom}' and '${cleanTo}' in the indexed repository.`
    };
  }

  private resolveSymbolNodes(symbolLower: string): string[] {
    // 1. Direct match in symbol map
    const direct = this.symbolToNodeIds.get(symbolLower);
    if (direct && direct.size > 0) return Array.from(direct);

    // 2. If query is "main", match file:main.js / file:main.py or main() function
    if (symbolLower === 'main' || symbolLower === 'main.js' || symbolLower === 'main.py') {
      const results: string[] = [];
      for (const [id, node] of this.nodes.entries()) {
        if (node.filePath.endsWith('main.js') || node.filePath.endsWith('main.py') || node.name.toLowerCase() === 'main') {
          results.push(id);
        }
      }
      if (results.length > 0) return results;
    }

    // 3. Partial match
    const results: string[] = [];
    for (const [key, nodeIds] of this.symbolToNodeIds.entries()) {
      if (key.includes(symbolLower) || symbolLower.includes(key)) {
        results.push(...Array.from(nodeIds));
      }
    }
    return results;
  }

  private resolveCalleeToNodeIds(calleeLower: string, calleeTerminal: string): string[] {
    const nodeIds: string[] = [];
    const direct = this.symbolToNodeIds.get(calleeLower) || this.symbolToNodeIds.get(calleeTerminal);
    if (direct) {
      nodeIds.push(...Array.from(direct));
    }
    return nodeIds;
  }

  public getStats() {
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      callsCount: this.edges.filter(e => e.kind === 'CALLS').length,
      importsCount: this.edges.filter(e => e.kind === 'IMPORTS').length,
      exportsCount: this.edges.filter(e => e.kind === 'EXPORTS').length,
      definitionsCount: this.edges.filter(e => e.kind === 'DEFINES').length
    };
  }
}
