# ExynoX Code Intelligence

> **Samsung PRISM Generative AI Hackathon 3rd Edition (2026–27)**  
> **Theme 1:** Agentic Code Intelligence  
> **Official Submission Ready**

---

## 1. Project Overview
**ExynoX Code Intelligence** is an agentic code intelligence, exploration, and localization platform engineered for large Python repositories and polyglot software projects. It allows developers to query complex codebases in natural language—pinpointing exact file paths, line numbers, semantic callers/callees, architectural relationships, and grounded explanations without dumping the entire codebase into raw LLM context windows.

---

## 2. Samsung PRISM Theme 1 Alignment
Modern software repositories contain thousands of files with intricate class inheritance, call hierarchies, multi-file imports, and dynamic dispatches. Developers spend excessive time tracing where functions are defined, which modules call them, or where system capabilities are invoked.

- **Problem Statement**: Standard lexical search (`grep`, regex) fails on conceptual questions and misses contextual call references. Raw LLM dumps exceed context token budgets and suffer from hallucinations.
- **Target Codebases**: Python repositories and the APPS benchmark dataset, alongside polyglot configuration and documentation files.
- **Core Architecture Principle**: **The LLM must never receive the entire repository as raw context.** ExynoX uses hierarchical indexing, AST static analysis, hybrid retrieval, and multi-step agentic tool execution to inspect only relevant code slices.

---

## 3. Architecture Summary Across Phases

```
                    ┌──────────────────────────────────────┐
                    │       User Codebase Query            │
                    └──────────────────┬───────────────────┘
                                       │
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
┌─────────────────────────────────┐               ┌──────────────────────────────────────┐
│  Deterministic Mode (AI OFF)    │               │     Agentic Mode (AI Active)         │
│  - Python AST Structural Engine │               │  - Controlled Agentic Planner Loop   │
│  - BM25 Lexical + Hybrid Match  │               │  - Iterative Tool-Use (Inspect/Trace)│
│  - Caller/Callee Graph Analysis │               │  - Evidence Sufficiency Verifier     │
│  - Zero API Key Required        │               │  - Grounded AI Answer Synthesis      │
└────────────────┬────────────────┘               └──────────────────┬───────────────────┘
                 │                                                   │
                 ▼                                                   ▼
┌─────────────────────────────────┐               ┌──────────────────────────────────────┐
│       Retrieved Evidence        │               │    Grounded Answer + Verified Files  │
│  Exact Line Slices & Citations  │               │    File Paths & Exact Line Numbers   │
└─────────────────────────────────┘               └──────────────────────────────────────┘
```

### Phase 1: Repository Ingestion & Workspace
- **ZIP Ingestion**: Secure client-side ZIP decompression via `jszip`.
- **GitHub Ingestion**: Direct connection and branch/file fetching from public GitHub repositories.
- **Security & Safety**: Path traversal rejection (`..`), file size safeguards, binary and cache filtering (`.git`, `__pycache__`, `.venv`, `.pyc`).
- **Deterministic Workspace**: `RepositoryWorkspace` providing exact line slicing (`getFileLines`), full text retrieval (`readFile`), and lexical indexing (`searchText`).
- **Sample Repository**: Built-in `samsung-prism-device-hub` multi-module Python application.

### Phase 2: Python AST Intelligence
- **CPython ASDL-Compliant AST**: Integrated zero-dependency `py-ast` parser.
- **Structural Extraction**: Functions, async functions, classes, methods, decorators, parameter signatures, and docstrings.
- **Call Relationships**: Tracks callers, callees, exact call site lines, and confidence ratings.
- **Import Resolution**: Absolute and relative module imports, symbol aliasing, and cross-file references.

### Phase 3: Hybrid Retrieval & Multi-Language Analysis
- **Multi-Language Support**: Automatic detection of Python, TypeScript, JavaScript, HTML, CSS, JSON, YAML, Markdown, and shell scripts.
- **Repository Statistics**: Accurate file counts, total lines, code lines, comment lines, and blank lines.
- **Hybrid Retrieval**: Combines semantic embeddings with BM25 lexical token matching and AST structural boosting.
- **Count Query Disambiguation**: Deterministically identifies entity count queries without hallucinations.

### Phase 4: Controlled Agentic Retrieval & Multi-Provider AI
- **Controlled Agentic Loop**: Strict state machine: `PLAN → SEARCH → INSPECT → FOLLOW → VERIFY → REFINE → ANSWER`.
- **Termination Safeguards**: Hard execution caps (`maxIterations = 6`), loop detection via visited files set, evidence sufficiency checks, and graceful fallbacks.
- **Multi-Provider LLM Abstraction**:
  - Google Gemini (`gemini-2.5-flash`, `gemini-3.8-flash`, `gemini-3.8-pro`)
  - OpenAI GPT (`gpt-4o`, `gpt-4o-mini`, `o3-mini`)
  - Anthropic Claude (`claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`)
- **Deterministic Fallback**: Seamless operation without any API key.

### Phase 5: Structural & Usage Query Engine
- **Caller / Callee Hierarchy**: Deterministic resolution of who calls a function and what a function calls.
- **Definition Resolution**: Instant location of function, method, and class definitions with line boundaries.
- **Cross-File Reference Tracing**: Connects import statements to definition sites across directories.

### Phase 6: Evaluation & Benchmarking Engine
- **Objective Measurement**: Built-in benchmark engine measuring real, reproducible performance:
  - `precision@k` (k=1, 3, 5)
  - `recall`
  - `latency` (ms)
  - `indexing cost` (files, lines, bytes, AST parsing time)
- **Standard Benchmark Datasets**: 10 reproducible evaluation queries spanning Python definitions, callers, callees, polyglot files, and usage patterns.
- **Dual Evaluation Surfaces**: Both interactive in-app benchmark runner and automated CLI test suites.

### Phase 7: Productization & UX Polish
- **Focused Developer Interface**: Single-view application: *Repository → Ask question → Inspect evidence*.
- **Clear AI Mode UX**: Explicit distinction between Deterministic Mode (AI OFF) and Agentic Mode (AI Active).
- **Concise Investigation Panel**: Displays real operational progress without internal chain-of-thought or raw JSON payloads.
- **Verified Evidence UI**: Exact 1-based line numbers, language tags, copy-to-clipboard, and match badges.

---

## 4. Getting Started & Running Locally

### Prerequisites
- Node.js 20+ LTS or 22+
- npm 9+

### Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd exynox-code-intelligence
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   ```bash
   cp .env.example .env
   ```
   *Note: Server-side keys are optional. Users can enter their own API key directly in the web UI; user keys are held strictly in browser session memory.*

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

5. Build for production:
   ```bash
   npm run build
   ```

6. Start production server:
   ```bash
   npm start
   ```

---

## 5. Running the Test Suite & Benchmarks

### Running Unit & Integration Tests
ExynoX includes comprehensive test suites covering all architectural layers:
```bash
npm test
```
To run tests with a verbose reporter:
```bash
npm run test:run
```

### Running Evaluation Benchmarks
1. **Interactive In-App Benchmark Runner**:
   - In the top header or evaluation section, click **Evaluation & Benchmarks**.
   - Select the target repository (e.g. Sample Python Repository).
   - Click **Run Benchmark Suite**.
   - Real, live measurements will populate for `precision@k`, `recall`, `latency`, and `indexing cost`.
2. **CLI Benchmark Test Suite**:
   ```bash
   npx vitest run src/evaluation/__tests__/evaluationEngine.test.ts
   ```

---

## 6. Security & Privacy Statement Regarding API Keys

Security and data privacy are core architectural requirements of ExynoX:
1. **No Committed Keys**: Source files, configuration files, test suites, and documentation contain zero hardcoded secrets.
2. **Session Memory Only**: User-provided API keys are held strictly in temporary session memory (`sessionStorage`) within the user's active browser tab.
3. **No Permanent Storage**: Keys are never written to `localStorage`, cookies, or persistent browser databases.
4. **No Telemetry or Logging**: Keys are never sent to external analytics or logged to the console.
5. **Instant Revocation**: Clicking **Remove Key** or **Disable AI** immediately wipes the key from memory and reverts the application to Deterministic Mode.
6. **Zero-Key Full Functionality**: ExynoX is 100% functional in Deterministic Mode without any API key.

---

## 7. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Icons** | Lucide React |
| **AST Engine** | `py-ast` (CPython ASDL compliant) |
| **Archive Ingestion** | `jszip` |
| **Testing** | Vitest |
| **Server Backend** | Express + TypeScript (`server.ts` with `tsx` / `esbuild`) |
| **Runtime Target** | Node.js 22 LTS / Containerized Cloud Run |

---

## 8. Hackathon Submission Tag
Official submission tag for Samsung PRISM Gen AI Hackathon:  
`PRISM_GENAI_HACKATHON_Y2026`
