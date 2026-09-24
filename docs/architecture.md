# ExynoX Code Intelligence — Architecture Specification

> **Samsung PRISM Gen AI Hackathon 2026–27**  
> **Theme 1:** Agentic Code Intelligence  
> **System Architecture Document**

---

## 1. Architectural Principles

1. **Bounded LLM Context Consumption**: The LLM must never receive an entire codebase as raw prompt context. Exploration is performed hierarchically through indexing, AST static analysis, and targeted tool-driven inspections.
2. **Deterministic-First Foundation**: All indexing, lexical search, AST parsing, and graph resolution are fully deterministic, functional offline, and require zero external API calls.
3. **Verified Evidence Grounding**: Answers must cite verified files, line boundaries, and code snippets rather than relying on ungrounded generative inference.
4. **Non-Invasive Security**: User API keys exist strictly in ephemeral session memory (`sessionStorage` per active tab) and are never persisted to disk or sent to telemetry.

---

## 2. Ingestion Layer

The Ingestion Layer normalizes raw repository sources into an in-memory `RepositoryWorkspace`.

```
[ZIP File / GitHub URL / Sample Repo]
                   │
                   ▼
       [Archive / Source Stream]
                   │
                   ▼
┌──────────────────────────────────────────────┐
│           Security & Path Sanitizer          │
│ - Rejects path traversal (..)                │
│ - Rejects absolute / root-level paths        │
│ - Enforces size limit (50 MB)                │
│ - Enforces file count cap (500 files)        │
│ - Strips binary & cache files (.git, .pyc)   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│            RepositoryWorkspace               │
│ - Map<filePath, RepositoryFile>              │
│ - Line normalization (\r\n -> \n)            │
│ - Slicing: getFileLines(path, start, end)    │
│ - Multi-language classification              │
│ - Lexical token indexing (BM25)              │
└──────────────────────────────────────────────┘
```

### Key Components:
- `zipIngestion.ts`: Unpacks `.zip` archives client-side using `jszip`.
- `githubIngestion.ts`: Clones public GitHub repository file trees and downloads source files via GitHub REST API.
- `sampleRepository.ts`: Instantiates the deterministic `samsung-prism-device-hub` repository.
- `repositoryWorkspace.ts`: Thread-safe, indexed in-memory representation supporting exact 1-based line slicing and lexical token lookups.

---

## 3. Python AST Analysis Engine

The AST analysis engine parses Python files into concrete Abstract Syntax Trees using `py-ast` (compatible with CPython ASDL).

```
Python Source File (.py)
          │
          ▼
    [py-ast Parser]
          │
          ▼
┌─────────────────────────────────────────────┐
│          Structural Visitor Engine          │
│                                             │
│ 1. Functions & Methods:                     │
│    - def / async def name, start, end line  │
│    - Parameters, defaults, docstrings       │
│                                             │
│ 2. Classes:                                 │
│    - class Name(Bases), inheritance         │
│    - Methods, attributes, static/classmethods│
│                                             │
│ 3. Call Sites:                              │
│    - Caller scope -> callee expression      │
│    - Exact call line, confirmed/likely      │
│                                             │
│ 4. Imports:                                 │
│    - import module                          │
│    - from module import symbol as alias     │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│             AST Structural Index            │
│ - symbolIndex: Map<name, SymbolDefinition[]>│
│ - callerMap:   Map<callee, CallSite[]>      │
│ - calleeMap:   Map<caller, CallSite[]>      │
│ - importIndex: Map<module, ImportStatement[]>│
└─────────────────────────────────────────────┘
```

### Deterministic Capabilities:
- **`findFunctionDefinition(name)`**: Returns exact file and line range `[startLine, endLine]` where `name` is defined.
- **`findClassDefinition(name)`**: Returns class definition boundary and associated methods.
- **`findCallers(calleeName)`**: Returns all functions and files that invoke `calleeName`.
- **`findCallees(callerName)`**: Returns all functions invoked inside `callerName`.
- **`findImports(symbolOrModule)`**: Locates all import sites across the codebase.

---

## 4. Hybrid Retrieval Model

ExynoX combines three complementary retrieval dimensions to achieve high recall and high precision:

$$\text{Score}(d, q) = w_{\text{lexical}} \cdot S_{\text{BM25}}(d, q) + w_{\text{semantic}} \cdot S_{\text{cosine}}(d, q) + w_{\text{structural}} \cdot S_{\text{AST}}(d, q)$$

```
                       User Query
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  BM25 Token  │    │  Trigram /   │    │ AST Symbol   │
│   Matching   │    │  Embedding   │    │   Boosting   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
               [Reciprocal Rank Fusion]
                           │
                           ▼
              [Top-K Candidate Slices]
```

1. **BM25 Lexical Matching**: Tokenizes queries into identifier tokens, camelCase / snake_case splits, and matches against workspace index.
2. **Semantic Trigram / Dense Scoring**: Evaluates conceptual keyword overlap for queries lacking literal symbol names.
3. **AST Structural Boost**: If a candidate matches a confirmed function, class, or caller definition, its relevance score is boosted.
4. **Count Query Disambiguation**: Deterministically identifies queries requesting entity counts (e.g., "how many drivers", "how many files", "how many classes") without AI hallucination.

---

## 5. Agentic Planning and Verification Flow

When AI Mode is enabled, ExynoX invokes a controlled agentic state machine:

```
                  ┌──────────────────────┐
                  │    User Question     │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  UNDERSTANDING &     │
                  │  PLANNING            │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  SEARCHING           │
                  │  (Hybrid Retrieval)  │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  INSPECTING          │
                  │  (Line Slice Sizer)  │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  FOLLOWING           │
                  │  (Call Graph / AST)  │
                  └──────────┬───────────┘
                             │
                             ▼
               ┌────────────────────────────┐
               │    VERIFYING EVIDENCE      │
               │ Is evidence sufficient?    │
               └──────┬──────────────┬──────┘
                      │              │
             No (and  │              │ Yes (or max
             iter < 6)│              │ iterations reached)
                      ▼              ▼
           ┌────────────────┐ ┌────────────────────────┐
           │ REFINE SEARCH  │ │ GROUNDED AI SYNTHESIS  │
           │ (Next symbol)  │ │ File citations + lines │
           └───────┬────────┘ └────────────────────────┘
                   │
                   └───────► (Loop to SEARCHING)
```

### Operational Steps:
1. **UNDERSTANDING**: Analyzes question intent (definition, usage, pipeline flow, caller query).
2. **PLANNING**: Generates an actionable investigation plan specifying candidate files.
3. **SEARCHING**: Executes hybrid retrieval across the indexed workspace.
4. **INSPECTING**: Reads targeted line slices of candidate files (`getFileLines`).
5. **FOLLOWING**: Traces caller/callee references and import chains.
6. **VERIFYING**: Evaluates whether retrieved evidence answers the user's question.
7. **GROUNDED SYNTHESIS**: Produces a structured explanation citing verified files and line numbers.

---

## 6. Evaluation & Benchmarking Methodology

In accordance with Samsung PRISM Theme 1 requirements, ExynoX includes a reproducible evaluation engine.

### Metrics Measured:
- **`Precision@k`** ($k \in \{1, 3, 5\}$): Proportion of retrieved candidate files in top-$k$ results that match the ground-truth relevant files.
  $$\text{Precision}@k = \frac{|\text{Top-}k \cap \text{GroundTruth}|}{k}$$
- **`Recall`**: Proportion of ground-truth relevant files retrieved across all candidates.
  $$\text{Recall} = \frac{|\text{Retrieved} \cap \text{GroundTruth}|}{|\text{GroundTruth}|}$$
- **`Latency`**: Execution duration measured in milliseconds per query (`performance.now()`).
- **`Indexing Cost`**:
  - Total files indexed
  - Total lines indexed
  - Total bytes ingested
  - AST parse elapsed time (ms)

### Ground Truth Suite:
The benchmark suite evaluates 10 standardized query cases across the sample repository, testing:
- Exact function definition localization
- Call hierarchy and caller identification
- Polyglot configuration lookup (YAML/Markdown)
- Natural language behavioral queries
