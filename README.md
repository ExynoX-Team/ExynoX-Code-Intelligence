# ExynoX Code Intelligence

> **Samsung PRISM Generative AI Hackathon — 3rd Edition (2026–27)**  
> **Theme 1 — Agentic Code Intelligence**

[![Theme](https://img.shields.io/badge/Samsung%20PRISM-Theme%201-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](#)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)](#)
[![Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest)](#)
[![License](https://img.shields.io/badge/license-hackathon%20project-lightgrey)](#)

**ExynoX Code Intelligence** is an agentic code-intelligence platform designed to help developers understand and navigate large software repositories using natural-language questions.

Instead of sending an entire repository to an LLM, ExynoX combines **repository indexing, lexical retrieval, semantic retrieval, AST-based structural analysis, deterministic source inspection, and controlled agentic investigation** to identify relevant code and provide grounded answers with exact source locations.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Samsung PRISM Theme 1 Alignment](#2-samsung-prism-theme-1-alignment)
- [3. Core Idea](#3-core-idea)
- [4. System Architecture](#4-system-architecture)
- [5. End-to-End Workflow](#5-end-to-end-workflow)
- [6. Agentic Investigation Loop](#6-agentic-investigation-loop)
- [7. Repository Intelligence Pipeline](#7-repository-intelligence-pipeline)
- [8. Key Capabilities](#8-key-capabilities)
- [9. Structural Code Intelligence](#9-structural-code-intelligence)
- [10. Hybrid Retrieval](#10-hybrid-retrieval)
- [11. Deterministic vs Agentic Mode](#11-deterministic-vs-agentic-mode)
- [12. Evidence Grounding](#12-evidence-grounding)
- [13. Evaluation & Benchmarking](#13-evaluation--benchmarking)
- [14. Security & API Key Handling](#14-security--api-key-handling)
- [15. Technology Stack](#15-technology-stack)
- [16. Project Structure](#16-project-structure)
- [17. Getting Started](#17-getting-started)
- [18. Testing](#18-testing)
- [19. Deployment](#19-deployment)
- [20. Limitations](#20-limitations)
- [21. Future Improvements](#21-future-improvements)
- [22. Hackathon Submission](#22-hackathon-submission)

---

# 1. Project Overview

Large software repositories are difficult to understand through ordinary keyword search.

A developer may ask questions such as:

- Where is this function defined?
- Which files call this function?
- What code path leads to this feature?
- Which module actually performs the prediction?
- Where is this class instantiated?
- Which files mention a capability but do not actually invoke it?
- What happens after this function is called?

Traditional search can find matching text, but it does not reliably understand **code structure, relationships, usage, or intent**.

ExynoX addresses this problem through a layered code-intelligence architecture.

### Core principle

> **The LLM should never receive the entire repository as raw context.**

Instead, ExynoX progressively retrieves only the evidence required to answer a question.

---

# 2. Samsung PRISM Theme 1 Alignment

## Theme

**Theme 1 — Agentic Code Intelligence**

## Problem Statement

Modern repositories may contain thousands of files and complex relationships between:

- functions
- classes
- modules
- imports
- call sites
- configuration files
- documentation
- generated artifacts

Pure lexical search can miss conceptual relationships, while sending an entire repository to an LLM creates context-window, cost, latency, and grounding problems.

## ExynoX Approach

ExynoX combines:

1. Repository ingestion
2. File and line indexing
3. Lexical retrieval
4. Local semantic retrieval
5. AST-based structural analysis
6. Caller/callee tracing
7. Agentic planning
8. Evidence verification
9. Grounded answer synthesis

This allows the system to investigate a repository incrementally instead of treating the entire codebase as a single prompt.

---

# 3. Core Idea

```text
                 ┌─────────────────────────┐
                 │     Developer Question   │
                 └────────────┬────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │     Query Understanding │
                 └────────────┬────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
       ┌─────────────────┐        ┌──────────────────┐
       │ Lexical Search  │        │ Structural Query │
       │ BM25 / Tokens   │        │ AST / Relations  │
       └────────┬────────┘        └─────────┬────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
                    ┌──────────────────┐
                    │ Hybrid Retrieval │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Evidence Inspect │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Verify Evidence  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Grounded Answer  │
                    └──────────────────┘
```

---

# 4. System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                         EXYNOX                                  │
│                  CODE INTELLIGENCE SYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

                         USER
                          │
                          ▼
              ┌───────────────────────┐
              │ Natural Language Query│
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Query Understanding   │
              │ + Intent Detection    │
              └───────────┬───────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
       ┌─────────┐   ┌──────────┐  ┌─────────────┐
       │ Lexical │   │ Semantic │  │ Structural  │
       │ Search  │   │ Retrieval│  │ AST Engine  │
       └────┬────┘   └─────┬────┘  └──────┬──────┘
            │              │              │
            └──────────────┼──────────────┘
                           ▼
                  ┌──────────────────┐
                  │ Hybrid Ranker    │
                  │ + RRF / Boosting │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Candidate Files  │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Agentic Planner  │
                  └────────┬─────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
       ┌─────────┐    ┌─────────┐   ┌──────────┐
       │ Search  │    │ Inspect │   │ Follow   │
       │         │    │ Files   │   │ Relations│
       └────┬────┘    └────┬────┘   └─────┬────┘
            │              │              │
            └──────────────┼──────────────┘
                           ▼
                  ┌──────────────────┐
                  │ Evidence Verifier│
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Grounded Answer  │
                  │ + Source Lines   │
                  └──────────────────┘
```

---

# 5. End-to-End Workflow

```text
Repository
    │
    ▼
┌──────────────────────┐
│ Secure Ingestion     │
│ ZIP / GitHub / Sample│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Repository Workspace │
│ Files + Lines        │
└──────────┬───────────┘
           │
           ├───────────────────┐
           ▼                   ▼
┌──────────────────┐   ┌────────────────────┐
│ Lexical Index    │   │ Structural Index   │
│ BM25 / Tokens    │   │ AST / Calls / Refs │
└────────┬─────────┘   └──────────┬─────────┘
         │                        │
         └────────────┬───────────┘
                      ▼
             ┌────────────────┐
             │ Hybrid Ranking │
             └───────┬────────┘
                     │
                     ▼
             ┌────────────────┐
             │ Agent Planner  │
             └───────┬────────┘
                     │
                     ▼
       ┌───────────────────────────────┐
       │ Search → Inspect → Follow     │
       │ → Verify → Refine → Answer    │
       └───────────────┬───────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Verified Evidence│
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Final Answer     │
              │ + Files + Lines  │
              └──────────────────┘
```

---

# 6. Agentic Investigation Loop

The agent does not simply retrieve documents and immediately generate an answer.

It follows a controlled investigation process:

```text
             ┌─────────────┐
             │   PLAN      │
             └──────┬──────┘
                    ▼
             ┌─────────────┐
             │   SEARCH    │
             └──────┬──────┘
                    ▼
             ┌─────────────┐
             │   INSPECT   │
             └──────┬──────┘
                    ▼
             ┌─────────────┐
             │   FOLLOW    │
             └──────┬──────┘
                    ▼
             ┌─────────────┐
             │   VERIFY    │
             └──────┬──────┘
                    ▼
             ┌─────────────┐
             │   REFINE    │
             └──────┬──────┘
                    │
             Evidence sufficient?
                │           │
               NO          YES
                │           │
                └───►───────┘
                            ▼
                     ┌────────────┐
                     │   ANSWER   │
                     └────────────┘
```

### Agent safeguards

The investigation engine uses:

- bounded execution
- visited-file tracking
- evidence sufficiency checks
- deterministic source tools
- graceful fallbacks
- evidence verification before synthesis

The system is designed so that the LLM acts as an **investigator and reasoning layer**, while repository tools remain the source of truth.

---

# 7. Repository Intelligence Pipeline

## Phase 1 — Repository Ingestion

ExynoX can ingest repository content through supported repository sources and archives.

Capabilities include:

- ZIP repository ingestion
- Public GitHub repository ingestion
- Built-in sample repository
- Secure extraction
- Path traversal protection
- File-size safeguards
- Binary filtering
- Cache/build artifact filtering

Ignored or filtered content includes common directories and artifacts such as:

```text
.git/
node_modules/
dist/
build/
coverage/
.venv/
__pycache__/
```

---

## Phase 2 — Repository Workspace

The `RepositoryWorkspace` provides deterministic access to repository content.

Core operations include:

```text
listFiles()
readFile()
getFileLines()
searchText()
getRepositoryStats()
```

This gives the investigation engine exact control over repository evidence and source-line locations.

---

# 8. Key Capabilities

### Natural-Language Code Search

Ask questions such as:

```text
Where is the prediction model defined?
```

or:

```text
Which functions call the prediction function?
```

or:

```text
Where is this feature actually used?
```

---

### Structural Code Intelligence

ExynoX can reason about:

- definitions
- functions
- methods
- classes
- imports
- callers
- callees
- call sites
- cross-file relationships

---

### Exact Evidence

Answers can point to:

```text
pipeline/predict.py — Line 42
models/predictor.py — Line 18
main.py — Lines 31–36
```

rather than only returning a file-level match.

---

### Repository Statistics

The system can calculate repository-level statistics including:

- file count
- total lines
- code lines
- comment lines
- blank lines
- indexed content

---

# 9. Structural Code Intelligence

JavaScript and TypeScript repositories receive AST-based structural analysis.

The structural engine extracts information such as:

```text
Source File
    │
    ├── Functions
    │      ├── Definition
    │      ├── Parameters
    │      └── Call Sites
    │
    ├── Classes
    │      ├── Methods
    │      └── References
    │
    ├── Imports
    │
    └── Cross-file Relationships
```

This enables queries involving:

- function definitions
- method definitions
- callers
- callees
- imports
- references
- call chains
- exact source locations

Additional repository formats can also participate in retrieval, including Python, HTML, CSS, JSON, YAML, Markdown, and shell scripts.

---

# 10. Hybrid Retrieval

ExynoX does not depend on a single retrieval technique.

Instead, retrieval combines multiple signals:

```text
                 Query
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
   Lexical     Semantic    Structural
    Match        Match        Match
       │           │           │
       └───────────┼───────────┘
                   ▼
             Score Fusion
                   │
                   ▼
             Ranked Evidence
```

### Retrieval signals

**Lexical retrieval**

Finds direct token and keyword matches.

**Semantic retrieval**

Provides meaning-oriented similarity using the local deterministic vectorization pipeline.

**Structural retrieval**

Boosts code entities and relationships identified through AST analysis.

**Reciprocal Rank Fusion**

Combines candidate rankings into a unified retrieval result.

This allows ExynoX to handle both:

- exact code terminology
- conceptual natural-language questions

---

# 11. Deterministic vs Agentic Mode

## Deterministic Mode — AI OFF

The system works without an external LLM API key.

```text
Query
  ↓
Retrieval
  ↓
Structural Analysis
  ↓
Evidence Verification
  ↓
Deterministic Answer
```

Benefits:

- no API key required
- reproducible behavior
- deterministic repository evidence
- useful for testing and benchmarking

---

## Agentic Mode — AI ON

When an AI provider is enabled:

```text
Query
  ↓
Planner
  ↓
Tool Execution
  ↓
Repository Investigation
  ↓
Evidence Verification
  ↓
LLM Synthesis
```

The AI provider is used for investigation planning and grounded answer synthesis, while repository tools provide the underlying evidence.

---

# 12. Evidence Grounding

A core design goal of ExynoX is reducing unsupported answers.

The system validates repository evidence before presenting it.

```text
Candidate Evidence
       │
       ▼
Does file exist?
       │
       ▼
Does line range exist?
       │
       ▼
Does source contain expected evidence?
       │
       ▼
Relationship verified?
       │
       ▼
Include in answer
```

This allows the UI to expose:

- verified file paths
- exact line numbers
- source snippets
- relationship evidence
- match types

The system does not treat an LLM-generated file path or line number as authoritative without repository verification.

---

# 13. Evaluation & Benchmarking

ExynoX includes an evaluation framework for measuring retrieval and indexing performance.

### Metrics

| Metric | Purpose |
|---|---|
| Precision@1 | Relevance of the top result |
| Precision@3 | Relevance among top three results |
| Precision@5 | Relevance among top five results |
| Recall | Coverage of relevant evidence |
| Mean Latency | Average query response time |
| P90 Latency | Tail query latency |
| Indexing Cost | Files, lines, bytes and parsing cost |
| Grounding Rate | Answers supported by verified evidence |

### Benchmark workflow

```text
Benchmark Query
      │
      ▼
Run Retrieval
      │
      ▼
Collect Top-K Results
      │
      ▼
Compare Against Ground Truth
      │
      ▼
Calculate Metrics
      │
      ▼
Generate Evaluation Report
```

The repository contains automated tests and an interactive benchmark surface for reproducible evaluation.

> Benchmark results should be interpreted in the context of the benchmark size and repository used. Small evaluation sets are useful for regression testing but should not be treated as universal performance claims.

---

# 14. Security & API Key Handling

Security is treated as an architectural requirement.

### API key principles

- No hardcoded production API keys in source code
- User-provided keys are held in browser session memory
- Keys are not intentionally persisted in local storage
- Keys are not included in Git commits
- AI can be disabled at any time
- Deterministic mode remains available without an external API key

### Repository ingestion security

The ingestion layer includes safeguards against:

- path traversal
- oversized files
- unwanted binary content
- repository cache directories
- generated build artifacts

---

# 15. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Repository Archives | JSZip |
| JavaScript/TypeScript Parsing | Babel-based AST analysis |
| Backend | Express + TypeScript |
| Build Tool | Vite |
| Server Bundling | esbuild |
| Testing | Vitest |
| Runtime | Node.js 22 |
| Retrieval | Lexical + semantic + structural hybrid retrieval |
| AI Providers | Provider abstraction for supported LLM APIs |

---

# 16. Project Structure

```text
ExynoX-Code-Intelligence/
│
├── public/
│   └── exynox-logo.png
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   ├── repository/
│   │   ├── investigation/
│   │   └── ...
│   │
│   ├── services/
│   │   ├── agent/
│   │   ├── indexing/
│   │   ├── retrieval/
│   │   ├── repository/
│   │   ├── structural/
│   │   └── evaluation/
│   │
│   ├── evaluation/
│   └── ...
│
├── server.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
└── ...
```

---

# 17. Getting Started

## Prerequisites

- Node.js 20+ LTS or Node.js 22+
- npm 9+

## Installation

```bash
git clone https://github.com/ExynoX-Team/ExynoX-Code-Intelligence.git

cd ExynoX-Code-Intelligence

npm install
```

## Optional environment configuration

```bash
cp .env.example .env
```

Server-side provider keys are optional.

Users can also configure supported AI providers through the application interface.

> Never commit real API keys to the repository.

## Development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production build

```bash
npm run build
```

## Start production server

```bash
npm start
```

---

# 18. Testing

ExynoX uses Vitest for automated testing.

Run the complete test suite:

```bash
npm test
```

Run the test suite with the project test script:

```bash
npm run test:run
```

Run TypeScript validation:

```bash
npm run lint
```

Build the production application:

```bash
npm run build
```

### Recommended final verification

```bash
npm run lint
npm test
npm run build
```

All three should pass before creating the final hackathon submission tag.

---

# 19. Deployment

ExynoX can be deployed as a Node.js web application.

The project includes:

- Vite production build
- Express backend
- production start command
- GitHub Pages deployment workflow for the static frontend
- cloud deployment compatibility for the Node.js server

### Architecture

```text
                 Internet User
                       │
                       ▼
              ┌─────────────────┐
              │  Web Frontend   │
              │ React + Vite    │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Express Server  │
              │ API / LLM Proxy │
              └────────┬────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
       Repository Tools    AI Provider
```

---

# 20. Limitations

ExynoX is an engineering prototype and has several limitations.

### Repository scale

Very large repositories can increase indexing time and memory requirements.

### Dynamic language behavior

Static AST analysis cannot perfectly resolve every runtime behavior, especially:

- dynamic imports
- reflection
- generated code
- runtime dependency injection
- highly dynamic dispatch

### Benchmark scale

Evaluation metrics depend on the size and quality of the benchmark ground truth.

Small benchmark suites are primarily useful for regression testing and engineering validation.

### AI Provider Availability

Agentic mode depends on the availability, quotas, and limits of the configured AI provider.

Deterministic mode remains available without an external AI provider.

---

# 21. Future Improvements

Potential future work includes:

- deeper cross-language structural analysis
- incremental repository indexing
- persistent vector indexes
- richer call-graph construction
- dependency graph visualization
- improved ranking calibration
- larger benchmark datasets
- repository-level caching
- parallel agent tool execution
- more advanced symbol resolution
- improved large-monorepo scalability

---

# 22. Hackathon Submission

## Samsung PRISM Generative AI Hackathon

**Edition:** 3rd Edition (2026–27)

**Theme:** Theme 1 — Agentic Code Intelligence

**Project:** ExynoX Code Intelligence

### Submission Components

- Source code
- Reproducible setup instructions
- Architecture documentation
- Evaluation and benchmarking
- Demonstration
- Presentation
- Final tagged commit

### Official Submission Tag

```text
PRISM_GENAI_HACKATHON_Y2026
```

The final tag should point to the commit containing the complete final submission package.

---

# ExynoX in One Sentence

> **ExynoX turns natural-language questions into verified codebase investigations by combining hybrid retrieval, structural code intelligence, deterministic repository tools, and controlled agentic reasoning.**

---

## Built for Samsung PRISM — Theme 1

**ExynoX Team**

**Agentic Code Intelligence for Large Software Repositories**