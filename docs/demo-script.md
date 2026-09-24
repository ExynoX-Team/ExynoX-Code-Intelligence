# ExynoX Code Intelligence — 5-Minute Hackathon Demo Script

> **Samsung PRISM Generative AI Hackathon 2026–27**  
> **Theme 1:** Agentic Code Intelligence  
> **Evaluation & Submission Demo Guide**

This document provides a concise, step-by-step walkthrough to demonstrate ExynoX's core capabilities in under 5 minutes.

---

## Prerequisites
- Start the application: `npm run dev`
- Open browser at `http://localhost:3000`

---

## Step 1: Landing Page & Brand Overview (30 seconds)
1. **Highlight the interface**:
   - Point out the clean developer-first aesthetic: *"ExynoX Code Intelligence — Ask your codebase anything"*.
   - Point out the top header badge: **Samsung PRISM • Theme 1**.
   - Note the three direct repository connection options: **Upload Repository**, **GitHub Repository**, and **Try Sample Repository**.
2. **Note AI State**:
   - The top status badge indicates **AI Not Active (Deterministic Mode)**.
   - Clarify: *ExynoX functions 100% deterministically without requiring an API key.*

---

## Step 2: Ingest the Sample Repository (30 seconds)
1. Click **Try Sample Repository**.
2. Observe the real-time progress card:
   - *Mounting Samsung Device Hub sample repository...*
   - *Reading structured module tree...*
   - *Normalizing Python source lines...*
   - *Building repository workspace and semantic index...*
3. Notice the completed **Repository Status Badge**:
   - Repository: `samsung-prism-device-hub` (Ready)
   - 11 total files (8 Python), 4 languages, 559 total lines
   - Python AST analysis: 17 functions, 6 classes, 16 call relationships

---

## Step 3: Deterministic Code Localization (60 seconds)
*Demonstrates fast AST and lexical matching with zero AI tokens.*

1. In the search input, type or select:
   ```
   Where is validate_token defined?
   ```
2. Click **Ask Codebase** (or press Enter).
3. Review the result:
   - Status banner: **Evidence found • AST Structural Engine (<15ms)**
   - **File**: `auth/login.py` | **Lines**: 48–56
   - **Match Badge**: `Symbol Match` / `Structural AST`
   - Exact Python source code snippet shown with 1-based line numbers.
   - Point out the **Copy** button and relevance score.

---

## Step 4: Structural AST Query Demo (60 seconds)
*Demonstrates caller and callee hierarchy resolution.*

1. In the search input, type:
   ```
   Who calls validate_token()?
   ```
2. Click **Ask Codebase**.
3. Observe the structural analysis:
   - **Caller**: `auth/middleware.py` inside `AuthenticationMiddleware.process_request()`
   - Exact call site at Line 108: `if not validate_token(token):`
   - Confidence: **Confirmed AST call site**
   - Direct line slice shown with contextual code around the call.

---

## Step 5: Activate Agentic AI Mode (60 seconds)
*Demonstrates multi-step investigation loop and grounded synthesis.*

1. In the top header, click the **AI Status Badge** (currently *AI Not Active*).
2. The **AI Configuration** modal opens:
   - Select provider: **Google Gemini**, **OpenAI GPT**, or **Anthropic Claude**.
   - Enter your API key.
   - Note the security notice: *Key is held strictly in volatile session memory; never persisted to disk or sent to analytics.*
   - Click **Activate AI**.
   - Badge updates to: **AI Active (Gemini)**.
3. In the search input, type:
   ```
   Where is user authentication handled?
   ```
4. Click **Ask Codebase**.
5. Observe the **ExynoX Investigation Panel**:
   - Real-time progression:
     - ✓ *Understanding question*
     - ✓ *Creating investigation plan*
     - ✓ *Searching repository*
     - ✓ *Inspecting candidates*
     - ✓ *Following references*
     - ✓ *Verifying evidence*
6. Review the **Grounded AI Synthesis**:
   - Structured explanation citing verified repository files.
   - Verified Evidence counter (e.g. *3 sources verified • 4 evidence items inspected*).
   - Cited repository files listed explicitly (`auth/login.py`, `auth/middleware.py`).

---

## Step 6: Evaluation & Benchmarking Demo (45 seconds)
*Demonstrates objective measurement against Theme 1 requirements.*

1. In the application header or benchmark section, open **Evaluation & Benchmarks**.
2. Click **Run Benchmark Suite**.
3. Watch the real, live measurements compute across the 10 benchmark tasks:
   - **Precision@1, Precision@3, Precision@5**
   - **Recall**
   - **Latency (ms)**
   - **Indexing Cost** (files, lines, bytes, AST parse duration)
4. Highlight: *All measurements are computed live from actual retrieval operations—no hardcoded metrics.*

---

## Step 7: Clean Disconnect & Security Verification (15 seconds)
1. Click the **AI Status Badge** and click **Disable AI** (or **Remove Key**).
2. The status immediately reverts to **AI Not Active (Deterministic Mode)**.
3. Session memory is wiped cleanly.
4. Click **Change** on the repository badge to return to the landing screen.
