# ExynoX Code Intelligence — Final Project History & Engineering Report

> **Samsung PRISM Generative AI Hackathon 2026–27**  
> **Theme 1:** Agentic Code Intelligence  
> **Document Type:** Comprehensive Technical & Development Journey Report  
> **Project Name:** ExynoX Code Intelligence  
> **Target System:** Large JavaScript/TypeScript Repositories & Polyglot Software Architectures  
> **Current Verification Status:** 159/159 Automated Tests Passing (15 Test Files) • Production Build Verified

---

## Notice on Source Attribution & Git History

> **Engineering Note:**  
> This report documents the implementation state represented by the source tree, automated test suite, architecture documentation, benchmark work, and project development history available during finalization. Commit-level claims are included only where they are supported by the project history available to the team.

The report distinguishes implementation/regression-test success from retrieval quality. A passing test suite does **not** imply that retrieval accuracy is 100%; retrieval effectiveness is evaluated separately using Precision@K, Recall, latency, and grounding measurements.

---

## 1. Executive Summary

ExynoX Code Intelligence was engineered as a submission for **Theme 1: Agentic Code Intelligence** of the Samsung PRISM Generative AI Hackathon 2026–27.

The central problem addressed by ExynoX is the difficulty of navigating large software repositories with conventional keyword search or unconstrained LLM prompting. Important code may be spread across multiple files, symbol names may differ from natural-language descriptions, and an LLM can produce unsupported file paths, line numbers, or relationships when it is not grounded in the repository.

ExynoX addresses this with a **Deterministic-First, Agentic-Second Architecture**:

1. **Deterministic repository intelligence:** repository ingestion, language detection, lexical retrieval, local semantic retrieval, JavaScript/TypeScript structural analysis, relationship queries, and evidence validation execute without requiring an LLM API key.
2. **Bounded agentic investigation:** when the user explicitly activates an AI provider, the investigation engine orchestrates deterministic tools through a multi-step workflow: **UNDERSTANDING → PLANNING → SEARCHING → INSPECTING → FOLLOWING → VERIFYING → SYNTHESIS**.
3. **Evidence-grounded synthesis:** cited repository files and line ranges are validated against the indexed workspace before being presented as verified evidence.
4. **Repository-agnostic investigation:** repository-specific symbols are resolved dynamically from the indexed codebase rather than relying on a hard-coded list of functions or filenames.

The final implementation combines:

- JavaScript/TypeScript-aware structural parsing
- BM25 lexical retrieval
- A deterministic local 128-dimensional semantic vectorizer
- Structural relevance signals
- Reciprocal Rank Fusion (RRF)
- Dedicated caller/callee/import/reference query routing
- Agentic investigation and grounded synthesis
- Quantitative evaluation infrastructure
- ZIP/GitHub/sample repository ingestion
- Session-scoped AI key handling
- Path traversal and repository-size protections

The final automated verification state is **159/159 tests passing across 15 test files**, with a successful production build.

---

## 2. Chronological Engineering Journey

### Phase 0: Project Inception & Structural Foundation

#### Objective & Scope

Establish the base workspace, developer interface, repository representation, and deterministic query workflow with a developer-first UX.

#### Original Implementation

- React + Vite + TypeScript application scaffolding.
- Main application layout with repository controls, query input, status indicators, and investigation/evidence panels.
- Initial repository loading and state-management concepts.
- Theme 1-oriented interface designed around the workflow: **repository → question → evidence → answer**.

#### Critical Problems & Edge Cases Discovered

- Large repository processing required predictable state boundaries.
- Browser/container environments can impose restrictions on global APIs such as `window.fetch`.
- The UI needed to distinguish deterministic operation from active AI operation rather than simulating AI activity.

#### Structural Fixes & Refactorings Applied

- Established strict TypeScript interfaces for repository and application state.
- Added defensive browser initialization/error handling.
- Separated deterministic repository intelligence from AI-provider state.
- Added explicit operational status and investigation-event visibility.

#### Final Implementation State

- Stable single-page application shell.
- Clear repository connection, query, investigation, and evidence workflows.
- Real-time repository and operating-mode indicators.

---

### Phase 1: Ingestion & Workspace Engineering

#### Objective & Scope

Construct a safe repository ingestion pipeline supporting local ZIP archives, public GitHub repositories, and built-in sample repositories.

#### Original Implementation

- `zipIngestion.ts` for client-side ZIP processing.
- `githubIngestion.ts` for repository retrieval.
- `repositoryWorkspace.ts` as the central in-memory representation of repository files.
- Line-ending normalization and deterministic 1-based line slicing.

#### Critical Problems & Edge Cases Discovered

- **Zip Slip / path traversal:** archive entries could contain `../` or absolute paths.
- **Archive exhaustion:** very large archives and generated directories could consume excessive browser memory.
- **Language assumptions:** repositories containing only JavaScript or TypeScript could not depend on a Python-only indexing path.
- Generated/vendor directories such as `.git`, `node_modules`, build outputs, caches, and coverage data should not dominate the index.

#### Structural Fixes & Refactorings Applied

- Added path sanitization rejecting traversal and absolute paths.
- Enforced repository ingestion limits, including the configured archive/file-count boundaries.
- Added filtering for binary/generated/cache content.
- Added language detection for JavaScript, TypeScript, Python, JSON, YAML, Markdown, CSS, Shell, and related source types.
- Refactored `RepositoryWorkspace` so indexing can proceed for JavaScript/TypeScript-only repositories without requiring Python analysis.

#### Final Implementation State & Testing

- Pure JavaScript and TypeScript repositories can be ingested.
- Polyglot repositories are supported.
- Repository files are normalized into a deterministic workspace.
- Multi-language ingestion is covered by automated tests.

---

### Phase 2: JavaScript & TypeScript Structural Intelligence

#### Objective & Scope

Build syntax-aware structural analysis for the hackathon's JavaScript-oriented Theme 1 target, with TypeScript support, so ExynoX can answer software-engineering relationship questions rather than only returning text matches.

#### Implementation

- `src/services/structural/astParser.ts` provides JavaScript/TypeScript syntax-aware parsing.
- `structuralIndex.ts` maintains symbol and relationship indexes.
- Structural information includes functions, classes, imports, calls, and relevant source locations.
- Exact 1-based line boundaries are retained for evidence presentation.
- Query routing is language-neutral and no longer restricted to a Python-only analysis gate.

#### Critical Problems & Edge Cases Discovered

- A lexical match does not prove that a function is actually called.
- Symbol names can occur in definitions, comments, imports, and unrelated contexts.
- Structural queries need explicit handling for definitions, callers, callees, imports, and references.
- A parser failure in one file should not prevent the entire repository from being indexed.

#### Structural Fixes & Refactorings Applied

- Added per-file parsing resilience.
- Added symbol and call-site indexing.
- Added caller/callee and import relationship lookup.
- Added exact source-line tracking.
- Updated structural query routing and hybrid retrieval so JavaScript/TypeScript structural information participates in normal retrieval.

#### Final Implementation State

ExynoX can combine lexical evidence with structural evidence for JavaScript/TypeScript repositories and can fall back gracefully to lexical/semantic retrieval when structural analysis is unavailable.

---

### Phase 3: Hybrid Retrieval Architecture

#### Objective & Scope

Combine exact lexical matching, local semantic similarity, and structural relevance so natural-language questions can retrieve useful code even when terminology does not exactly match source identifiers.

#### Original Implementation

- BM25 lexical retrieval.
- Basic keyword matching over indexed code chunks.

#### Critical Problems & Edge Cases Discovered

- Natural-language vocabulary can differ from source identifiers.
- Arbitrary chunk boundaries can separate related code from its structural context.
- Retrieval needs a mechanism for combining independent evidence signals.

#### Structural Fixes & Refactorings Applied

The hybrid retriever combines multiple signals and uses Reciprocal Rank Fusion to produce a final ranking:

```text
Lexical evidence
      +
Local semantic evidence
      +
Structural AST evidence
      ↓
Reciprocal Rank Fusion
      ↓
Ranked repository candidates
```

`LocalEmbeddingProvider.ts` provides a deterministic **128-dimensional** local representation using subword/token, character-trigram, and curated domain-concept features. It runs locally without downloading a large neural embedding model.

The retrieval layer also uses syntax-aware chunking where available so relevant functions/classes are less likely to be split across arbitrary boundaries.

#### Final Implementation State & Testing

- BM25 lexical retrieval is available.
- Local semantic retrieval is available without an external embedding API.
- Structural AST relevance participates in retrieval for supported source languages.
- Hybrid retrieval behavior is covered by indexing and real-world verification tests.

---

### Phase 4: Agentic Investigation & Reasoning Layer

#### Objective & Scope

Create a bounded investigation workflow that can answer multi-file software-engineering questions by orchestrating deterministic repository tools and, when enabled, an LLM for planning/synthesis.

#### Critical Problems & Edge Cases Discovered

- Simulated AI activity when AI was inactive could mislead users.
- A model definition is not necessarily a model usage site.
- Generative answers can cite comments, documentation, or nonexistent files unless evidence is explicitly verified.
- Repository-specific symbols should not be hard-coded into the investigation engine.

#### Structural Fixes & Refactorings Applied

**Strict mode separation**

- **Deterministic Mode:** works without an AI API key and uses repository retrieval/structural tools directly.
- **Agentic AI Mode:** activated only after the user provides an API key for a supported provider.

**Investigation loop**

1. `UNDERSTANDING` — interpret the question and target concepts.
2. `PLANNING` — determine an investigation strategy.
3. `SEARCHING` — retrieve candidate repository evidence.
4. `INSPECTING` — inspect exact source ranges.
5. `FOLLOWING` — follow calls, imports, and other relationships.
6. `VERIFYING` — validate evidence against the workspace.
7. `SYNTHESIS` — produce a grounded explanation.

The investigation engine resolves explicit symbols dynamically against the repository's structural index instead of depending on an F1-specific hard-coded function list.

#### Final Implementation State & Testing

- Repository-agnostic investigation behavior is covered by hardening tests.
- Deterministic and AI modes are tested separately.
- Provider failures and recovery behavior are tested.
- Evidence verification prevents unsupported source references from being treated as verified evidence.

---

### Phase 5: Structural & Relationship Query Engine

#### Objective & Scope

Implement dedicated routing for software-engineering questions involving definitions, call chains, callers/callees, imports, references, and repository-level structural relationships.

#### Problems Addressed

- Text search alone cannot reliably answer "Who calls this function?"
- Definitions and usages must be distinguished.
- Structural questions should not be forced through a generic semantic-search path.
- Conceptual questions should fall back to general retrieval rather than being incorrectly classified as structural.

#### Structural Capabilities

- **Definition lookup:** locate symbol definitions and exact source ranges.
- **Call-chain tracing:** follow static relationships through the indexed repository.
- **Caller analysis:** identify functions/files that invoke a target symbol.
- **Callee analysis:** identify symbols invoked by a caller.
- **Import analysis:** resolve relevant import relationships.
- **Reference analysis:** locate usages of indexed symbols.
- **Query routing:** structural questions are handled explicitly; general behavioral questions continue through hybrid retrieval/investigation.

#### Final Implementation State

Structural query routing is language-aware at the parser/index level but language-neutral at the query-router level, allowing supported JavaScript/TypeScript structural evidence to participate without the previous Python-only gate.

---

### Phase 6: Evaluation & Benchmarking System

#### Objective & Scope

Build a reproducible quantitative evaluation harness aligned with Theme 1 requirements.

#### Metrics

- **Precision@K**
- **Recall**
- **Latency**
- **P90 latency**
- **Grounding rate**
- **Indexing statistics/cost indicators**

Precision@K follows the standard denominator:

\[
Precision@K = \frac{|Top\text{-}K \cap GroundTruth|}{K}
\]

The evaluation layer uses high-resolution timing and validates evidence against the actual repository workspace.

#### Benchmark Engineering

The project includes standardized repository queries and an F1 Lap Time Predictor benchmark used for real-world verification during development.

The benchmark is intentionally treated as a **small engineering benchmark**, not as a claim of universal retrieval accuracy. One recorded benchmark run produced:

- Precision@1: **25.0%**
- Precision@3: **20.8%**
- Precision@5: **12.5%**
- Mean latency: **0.74 ms**
- P90 latency: **3.36 ms**
- Grounding: **100%**
- Fabricated evidence: **0%**

These figures are measurements from the project's benchmark configuration and should be presented with the benchmark size/context rather than generalized to all repositories.

#### Final Implementation State

The evaluation engine calculates metrics from retrieval operations and includes automated tests for metric correctness, grounding validation, and benchmark behavior.

---

### Phase 7: Productization, Security Hardening & Documentation

#### Objective & Scope

Turn the prototype into a reproducible hackathon submission with secure repository ingestion, explicit AI configuration, reliable tests, deployment support, and aligned technical documentation.

#### Security & Reliability Work

- ZIP path traversal protection.
- Repository size/file-count boundaries.
- Generated/vendor directory filtering.
- No hard-coded provider API keys in source control.
- User API keys handled as session-scoped application state.
- Provider switching clears the previous active credential state.
- Deterministic mode remains available without an API key.
- Provider authentication, rate-limit, and unavailable-service errors are handled distinctly.

#### Documentation & Deployment

Updated project documentation includes:

- `README.md`
- `docs/architecture.md`
- `docs/demo-script.md`
- `docs/engineering-report.md`

The project also includes deployment configuration for GitHub Pages and Render, with Vite base-path handling for the respective hosting environments.

---

## 3. Final Acceptance Audit

| Audit Area | Requirement | Current Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Test Suite** | Automated tests pass in non-interactive mode | **PASSED** | 159/159 tests passing across 15 test files |
| **Production Build** | TypeScript/Vite production build succeeds | **PASSED** | `npm run build` completes successfully |
| **JavaScript/TypeScript Structural Intelligence** | Supported source repositories can use structural indexing | **PASSED** | Structural and multi-language test coverage |
| **Hybrid Retrieval** | Lexical + local semantic + structural signals | **PASSED** | Hybrid retriever and retrieval verification tests |
| **Repository-Agnostic Investigation** | No repository-specific hard-coded symbol dependency | **PASSED** | Investigation hardening tests |
| **Evidence Grounding** | Evidence must map to actual workspace files/lines | **PASSED** | Verification/evidence tests |
| **Path Traversal** | Reject unsafe ZIP paths | **PASSED** | ZIP ingestion validation |
| **Deterministic Mode** | Operates without an AI key | **PASSED** | Deterministic/AI mode tests |
| **AI Mode** | Tool-driven investigation with provider abstraction | **PASSED** | Agent and LLM registry tests |
| **Evaluation Engine** | Compute retrieval/evaluation metrics programmatically | **PASSED** | Evaluation tests |
| **Documentation** | Architecture, demo, and engineering documentation aligned | **PASSED** | Updated project documentation |

---

## 4. Comprehensive Change History & Bug Fix Log

### Fix 1: Browser Fetch Initialization Restriction

- **Symptom:** Browser/container environments could produce a `window.fetch` setter error.
- **Resolution:** Added defensive initialization/error handling around the affected browser API boundary.
- **Verification:** Application initialization tested in supported browser/container environments.

### Fix 2: Path Traversal in ZIP Archive Extraction

- **Symptom:** Unsafe archive entries could contain `../` or absolute paths.
- **Resolution:** Added explicit path validation before repository files are admitted to the workspace.
- **Verification:** Ingestion tests cover unsafe archive-path handling.

### Fix 3: JavaScript/TypeScript Repository Support

- **Symptom:** The earlier indexing architecture assumed Python availability.
- **Resolution:** Added language-aware ingestion and JavaScript/TypeScript structural analysis. Removed Python-only structural gates from the query/retrieval path.
- **Verification:** Multi-language and structural tests pass for non-Python repositories.

### Fix 4: Retrieval Signal Integration

- **Symptom:** Pure lexical retrieval could miss behaviorally related code.
- **Resolution:** Integrated BM25, deterministic local semantic vectors, and structural AST relevance through hybrid ranking/RRF.
- **Verification:** Retrieval and real-world verification tests.

### Fix 5: Repository-Specific Agent Logic

- **Symptom:** Earlier investigation logic contained repository-specific assumptions around known F1 symbols.
- **Resolution:** Symbol detection now resolves candidate symbols against the indexed structural repository instead of relying on a fixed function list.
- **Verification:** Investigation hardening tests cover the updated behavior.

### Fix 6: Definition vs. Usage Confusion

- **Symptom:** A retrieved definition could be mistaken for an actual usage site.
- **Resolution:** Investigation and structural evidence now distinguish definitions from call/use evidence where the repository permits static verification.
- **Verification:** Real-world F1 investigation tests cover model definition/usage disambiguation.

### Fix 7: Precision@K Calculation Bias

- **Symptom:** Short result sets could inflate Precision@K if the denominator was incorrectly based on retrieved-count rather than K.
- **Resolution:** Enforced K as the denominator.
- **Verification:** Evaluation tests cover short-result edge cases.

### Fix 8: AI Key Session Isolation

- **Symptom:** Persistent credential storage would increase exposure risk.
- **Resolution:** AI provider credentials are kept in session-scoped application state and cleared when AI is disabled or switched.
- **Verification:** LLM registry/configuration tests cover activation, provider switching, and removal.

### Fix 9: Stale Documentation and Test Commands

- **Symptom:** Documentation referenced earlier architecture and test behavior.
- **Resolution:** Updated README, architecture, demo script, and engineering report; standardized the non-interactive test command.
- **Verification:** Documentation now reflects the current JavaScript/TypeScript-oriented implementation and 159-test verification state.

---

## 5. Current System Architecture

ExynoX follows a layered design separating repository ingestion, structural analysis, hybrid retrieval, query routing, investigation, and evidence verification.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                              │
│                                                                           │
│  Repository: ZIP / GitHub / Sample                                       │
│  Query Input + Suggested Questions                                       │
│  Deterministic / AI Mode Indicator                                      │
│  Investigation Operations + Evidence Inspector                           │
│  Source Viewer with 1-based Line Numbers                                 │
└─────────────────────────────────┬─────────────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       QUERY ROUTING / DISPATCH                            │
│                                                                           │
│  Structural: definitions, callers, callees, imports, references, chains │
│  General: behavioral / conceptual questions                              │
└───────────────────────┬───────────────────────────┬───────────────────────┘
                        │                           │
                        ▼                           ▼
┌──────────────────────────────────┐   ┌───────────────────────────────────┐
│ JS / TS STRUCTURAL ENGINE        │   │ HYBRID RETRIEVAL ENGINE           │
│                                  │   │                                   │
│ • Syntax-aware parsing           │   │ • BM25 lexical retrieval          │
│ • Symbol definitions             │   │ • 128-D local semantic vectors   │
│ • Call relationships             │   │ • Structural relevance boost     │
│ • Imports / references           │   │ • Reciprocal Rank Fusion          │
└────────────────┬─────────────────┘   └─────────────────┬─────────────────┘
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
                    ┌────────────────────────────────┐
                    │     EVIDENCE / INVESTIGATION   │
                    │                                │
                    │  Deterministic fast path      │
                    │  OR                            │
                    │  Agentic investigation loop   │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │       VERIFICATION GATE         │
                    │                                │
                    │ • File existence               │
                    │ • Valid line ranges            │
                    │ • Structural evidence          │
                    │ • Grounding                    │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │       GROUNDED ANSWER          │
                    └────────────────────────────────┘

Repository Workspace
────────────────────────────────────────────────────────────────────────────
• In-memory file store
• Path sanitization / Zip Slip protection
• Line normalization and exact 1-based slicing
• Multi-language classification
• File filtering and ingestion limits
```

### Agentic Investigation Flow

```text
User Question
     │
     ▼
UNDERSTANDING
     │
     ▼
PLANNING
     │
     ▼
SEARCHING ───────► Hybrid Retrieval / Structural Queries
     │
     ▼
INSPECTING ──────► Exact Source Ranges
     │
     ▼
FOLLOWING ───────► Calls / Imports / References
     │
     ▼
VERIFYING ───────► Workspace Evidence Gate
     │
     ▼
SYNTHESIS ───────► Grounded Answer
```

---

## 6. Final Feature Matrix & Implementation Status

| Feature / Capability | Implementation Component | Status | Operational Mode |
| :--- | :--- | :--- | :--- |
| **ZIP Archive Ingestion** | `src/services/repository/zipIngestion.ts` | **Complete** | Deterministic |
| **GitHub Repository Ingestion** | `src/services/repository/githubIngestion.ts` | **Complete** | Deterministic / Network |
| **Path Traversal Protection** | ZIP ingestion | **Complete** | Deterministic |
| **Multi-Language Detection** | `src/services/indexing/languageDetector.ts` | **Complete** | Deterministic |
| **Repository Workspace** | `src/services/repository/repositoryWorkspace.ts` | **Complete** | Deterministic |
| **JavaScript/TypeScript Structural Parsing** | `src/services/structural/astParser.ts` | **Complete** | Deterministic |
| **Symbol / Relationship Indexing** | `src/services/structural/structuralIndex.ts` | **Complete** | Deterministic |
| **BM25 Retrieval** | `src/services/retrieval/lexicalIndex.ts` | **Complete** | Deterministic |
| **128-D Local Semantic Retrieval** | `src/services/retrieval/embeddings/` | **Complete** | Deterministic |
| **Structural Retrieval Boost** | `src/services/retrieval/hybridRetriever.ts` | **Complete** | Deterministic |
| **Reciprocal Rank Fusion** | Hybrid retrieval layer | **Complete** | Deterministic |
| **Definition / Caller / Callee Queries** | `src/services/structural/queryRouter.ts` | **Complete** | Deterministic |
| **Import / Reference Queries** | `queryRouter.ts` / structural index | **Complete** | Deterministic |
| **Agentic Investigation Loop** | `src/services/agent/investigationEngine.ts` | **Complete** | AI-assisted |
| **Evidence Verification** | Investigation/evidence layer | **Complete** | Deterministic |
| **LLM Provider Abstraction** | `src/services/llm/llmRegistry.ts` | **Complete** | Gemini / OpenAI / Anthropic |
| **Session-Scoped Key Handling** | LLM registry/configuration | **Complete** | Current session |
| **Evaluation Engine** | `src/evaluation/` | **Complete** | Deterministic |
| **Precision@K / Recall** | Evaluation calculators | **Complete** | Deterministic |
| **Latency / P90 Profiling** | Evaluation utilities | **Complete** | Deterministic |
| **GitHub Pages Deployment** | `.github/workflows/deploy.yml` | **Configured** | Hosted |
| **Render Deployment** | Render configuration | **Configured** | Hosted |

---

## 7. Testing & Verification Summary

The current project verification run contains:

```text
Test Files  15 passed (15)
Tests       159 passed (159)
```

The test suite covers the major engineering boundaries rather than treating the test count itself as a retrieval-accuracy score.

### Major Verification Areas

1. **Evaluation**
   - Precision@K denominator handling.
   - Recall calculations.
   - Latency statistics.
   - Evidence matching and grounding.

2. **Structural Intelligence**
   - Symbol extraction.
   - JavaScript/TypeScript structural behavior.
   - Caller/callee relationships.
   - Imports and references.
   - Syntax-error resilience.

3. **Hybrid Retrieval**
   - Lexical retrieval.
   - Local semantic retrieval.
   - Structural relevance integration.
   - Real-world repository retrieval checks.

4. **Agentic Investigation**
   - Deterministic investigation.
   - AI-mode investigation.
   - Evidence verification.
   - Follow-up conversational context.
   - Repository-agnostic symbol resolution.
   - Provider failure/recovery behavior.

5. **Multi-Language Repository Handling**
   - Pure TypeScript repositories.
   - Pure JavaScript repositories.
   - Mixed polyglot repositories.
   - Repositories without Python source.

6. **LLM Provider Configuration**
   - Provider selection.
   - Model selection.
   - API-key requirement.
   - Key activation/removal.
   - Provider isolation.

### Verification Interpretation

The **159/159 passing** result means the automated implementation/regression tests pass. It does **not** mean every repository query is retrieved correctly. Retrieval quality remains a separate empirical measurement.

---

## 8. Known Limitations & Architectural Boundaries

ExynoX intentionally documents the following limitations:

1. **Static Analysis vs. Dynamic Runtime Behavior**
   - Static structural analysis cannot fully resolve runtime-generated code, dynamic dispatch, reflection, or behavior that only becomes known during execution.

2. **Language-Specific Structural Depth**
   - JavaScript/TypeScript receive the project's primary structural-analysis treatment for the Theme 1 target.
   - Other supported languages can still be ingested and retrieved, but structural depth depends on the parser/indexing support available for that language.

3. **Local Semantic Vectorizer**
   - The 128-dimensional local vectorizer is deterministic and lightweight rather than a large transformer embedding model.
   - Highly nuanced semantic questions may benefit from the optional AI-assisted investigation layer.

4. **Client-Side Repository Limits**
   - Repository ingestion is intentionally bounded by configured file/archive limits to preserve browser responsiveness and avoid excessive memory consumption.

5. **Static Call-Graph Limits**
   - A static call relationship is evidence of source-level invocation, not proof of every possible runtime execution path.

6. **AI Provider Availability**
   - Agentic synthesis depends on the selected provider being reachable and accepting the supplied credentials.
   - Deterministic retrieval remains available when AI is unavailable.

---

## 9. Alignment with Samsung PRISM Gen AI Hackathon 2026–27

### Theme 1: Agentic Code Intelligence

| Theme 1 Requirement | ExynoX Implementation & Evidence |
| :--- | :--- |
| **Agentic Code Intelligence** | Multi-step investigation workflow with planning, deterministic tool invocation, relationship following, verification, and synthesis. |
| **Large Codebase Navigation** | Repository indexing and bounded retrieval reduce the need to place an entire codebase into an LLM context. |
| **Natural-Language Code Retrieval** | Hybrid lexical + local semantic + structural retrieval supports questions that do not exactly match identifiers. |
| **Structural / Usage Queries** | Definitions, callers, callees, imports, references, and call relationships are routed explicitly. |
| **Accuracy & Anti-Hallucination** | Evidence is checked against the indexed workspace before being treated as verified. |
| **Quantitative Evaluation** | Precision@K, Recall, latency, P90, grounding, and indexing statistics are available through the evaluation layer. |
| **Developer-First UX** | Repository → question → evidence workflow, exact line references, investigation visibility, and optional AI mode. |
| **Security** | Path traversal protection, bounded ingestion, and session-scoped AI credential handling. |

---

## 10. Final Technical Summary

ExynoX evolved from a conventional repository-search prototype into a structured **Agentic Code Intelligence** system.

Its final architecture is built around a clear separation of responsibilities:

- **Repository Workspace** provides safe, normalized source data.
- **Structural Intelligence** understands code relationships.
- **Hybrid Retrieval** combines lexical, semantic, and structural evidence.
- **Query Routing** chooses specialized structural operations where appropriate.
- **Investigation Engine** coordinates multi-step repository exploration.
- **Verification** prevents unsupported source references from being presented as verified evidence.
- **Evaluation** measures retrieval and system behavior quantitatively.
- **AI Providers** are optional and operate on bounded, tool-derived evidence rather than receiving an unrestricted repository dump.

The final automated verification state is **159/159 tests passing across 15 test files**, with a successful production build.

The system should be evaluated on the evidence demonstrated by the implementation, automated tests, benchmark measurements, and live hackathon demo rather than on the raw number of passing tests alone.

---

## Appendix A — Recommended Demo Evidence

For the final hackathon demonstration, prioritize a short sequence that visibly proves the architecture:

1. Connect a JavaScript/TypeScript repository.
2. Ask a symbol-definition question.
3. Ask a caller/callee or relationship question.
4. Show exact source lines and verified evidence.
5. Activate AI mode and demonstrate the investigation stages.
6. Show the final grounded synthesis.
7. Show quantitative evaluation results and explain the benchmark context.
8. Disable AI and demonstrate that deterministic repository intelligence continues to work.

This sequence maps directly to the Theme 1 workflow: **retrieve → reason → inspect → verify → answer**.
