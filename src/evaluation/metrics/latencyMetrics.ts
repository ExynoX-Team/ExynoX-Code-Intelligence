/**
 * ExynoX Code Intelligence — High-Resolution Latency Measurement
 * Samsung PRISM Gen AI Hackathon 2026–27 (Theme 1: Agentic Code Intelligence)
 *
 * Requirements:
 *   - Use high-resolution timers (performance.now()).
 *   - Record real start, end, and durationMs.
 *   - Never fabricate latency.
 *   - Do not silently delete slow queries; record all measurements.
 *   - Support repeatable runs (run 1, 2, 3...) and calculate mean, median, min, max, p90.
 */

import type { LatencyAggregate, QueryLatencyRecord, QueryLatencyBreakdown } from '../types.js';

export class HighResolutionTimer {
  private startTime: number = 0;
  private endTime: number = 0;
  private isRunning: boolean = false;

  start(): HighResolutionTimer {
    this.startTime = performance.now();
    this.endTime = 0;
    this.isRunning = true;
    return this;
  }

  stop(breakdown?: QueryLatencyBreakdown): QueryLatencyRecord {
    if (this.isRunning) {
      this.endTime = performance.now();
      this.isRunning = false;
    }
    const duration = Math.max(0, this.endTime - this.startTime);
    return {
      queryStart: this.startTime,
      queryEnd: this.endTime,
      durationMs: Number(duration.toFixed(2)),
      breakdown
    };
  }

  elapsedMs(): number {
    const current = this.isRunning ? performance.now() : this.endTime;
    return Math.max(0, current - this.startTime);
  }
}

/**
 * Calculates aggregate latency statistics across an array of real measured durations.
 * Outlier handling: Outliers are never discarded; min, max, median, mean, and p90 are preserved.
 */
export function calculateLatencyAggregate(durationsMs: number[]): LatencyAggregate {
  if (!durationsMs || durationsMs.length === 0) {
    return {
      count: 0,
      meanMs: 0,
      medianMs: 0,
      minMs: 0,
      maxMs: 0,
      p90Ms: 0,
      rawDurationsMs: []
    };
  }

  const sorted = [...durationsMs].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const meanMs = Number((sum / count).toFixed(2));

  // Median calculation
  const mid = Math.floor(count / 2);
  const medianMs = count % 2 !== 0 
    ? Number(sorted[mid].toFixed(2))
    : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));

  const minMs = Number(sorted[0].toFixed(2));
  const maxMs = Number(sorted[count - 1].toFixed(2));

  // 90th percentile
  const p90Index = Math.min(count - 1, Math.floor(count * 0.9));
  const p90Ms = Number(sorted[p90Index].toFixed(2));

  return {
    count,
    meanMs,
    medianMs,
    minMs,
    maxMs,
    p90Ms,
    rawDurationsMs: [...durationsMs]
  };
}
