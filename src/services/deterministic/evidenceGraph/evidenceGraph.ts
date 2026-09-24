/**
 * In-Memory Evidence Graph
 * Samsung PRISM Gen AI Hackathon (Theme 1: Agentic Code Intelligence)
 * Phase 6.6 — General-Purpose Deterministic Repository Intelligence Engine
 *
 * Represents retrieved repository evidence as a typed graph of nodes and verified edges.
 * Zero hardcoding. Zero LLM.
 */

import type { RelationshipEdge } from '../knowledgeModel/types.js';

export interface EvidenceNode {
  id: string;
  type: 'file' | 'symbol' | 'config' | 'doc' | 'asset' | 'line_range' | 'count';
  name: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  snippet?: string;
  score: number;
  metadata?: Record<string, any>;
}

export class EvidenceGraph {
  readonly nodes = new Map<string, EvidenceNode>();
  readonly edges: RelationshipEdge[] = [];
  readonly adjacency = new Map<string, Array<{ targetId: string; edge: RelationshipEdge }>>();

  addNode(node: EvidenceNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
      this.adjacency.set(node.id, []);
    } else {
      // Update score if higher
      const existing = this.nodes.get(node.id)!;
      if (node.score > existing.score) {
        existing.score = node.score;
      }
    }
  }

  addEdge(edge: RelationshipEdge): void {
    this.edges.push(edge);

    let list = this.adjacency.get(edge.sourceId);
    if (!list) {
      list = [];
      this.adjacency.set(edge.sourceId, list);
    }
    list.push({ targetId: edge.targetId, edge });
  }

  getNode(id: string): EvidenceNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): EvidenceNode[] {
    return Array.from(this.nodes.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Finds shortest path of evidence between two nodes.
   */
  findPath(startId: string, targetId: string): RelationshipEdge[] | null {
    if (startId === targetId) return [];

    const queue: Array<{ currentId: string; path: RelationshipEdge[] }> = [
      { currentId: startId, path: [] }
    ];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const { currentId, path } = queue.shift()!;
      if (path.length > 8) continue;

      const neighbors = this.adjacency.get(currentId) || [];
      for (const { targetId: nTargetId, edge } of neighbors) {
        const nextEdgePath = [...path, edge];
        if (nTargetId === targetId) {
          return nextEdgePath;
        }
        if (!visited.has(nTargetId)) {
          visited.add(nTargetId);
          queue.push({ currentId: nTargetId, path: nextEdgePath });
        }
      }
    }

    return null;
  }
}
