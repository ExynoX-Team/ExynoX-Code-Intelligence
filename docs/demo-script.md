# ExynoX Code Intelligence — 5-Minute Hackathon Demo Script

> **Samsung PRISM Generative AI Hackathon 2026–27**  
> **Theme 1:** Agentic Code Intelligence  
> **Evaluation & Submission Demo Guide**

This document provides a concise, repeatable walkthrough for demonstrating ExynoX Code Intelligence in under five minutes. The demo emphasizes repository understanding, JavaScript/TypeScript structural intelligence, hybrid retrieval, agentic investigation, and grounded evidence.

---

## Prerequisites

- Start the application with `npm run dev`.
- Open the local application shown by Vite in the terminal (typically `http://localhost:5173`).
- Have a repository ready to analyze, preferably the project's JavaScript/TypeScript sample repository.
- For the AI portion, have a valid provider API key available. The deterministic portion does **not** require an API key.

> **Demo safety:** Do not display or paste an API key into the recording. Enter it only into the application's AI configuration when demonstrating AI mode.

---

## Step 1: Landing Page & Project Overview — 25 seconds

### What to show

1. Open the ExynoX landing page.
2. Point out the main message:
   > **“ExynoX Code Intelligence — Ask your codebase anything.”**
3. Briefly show the repository entry points:
   - **Upload Repository**
   - **GitHub Repository**
   - **Try Sample Repository**
4. Point out the **Samsung PRISM • Theme 1** branding.
5. Show that the application can operate in **Deterministic Mode** without an AI provider.

### What to say

> “ExynoX is an agentic code-intelligence system for understanding large repositories. Instead of treating a codebase as plain text, it combines lexical retrieval, local semantic retrieval, and structural code analysis to locate relevant code and verify relationships.”

---

## Step 2: Repository Ingestion & Indexing — 30 seconds

### What to show

1. Click **Try Sample Repository** or connect the prepared repository.
2. Let the repository workspace initialize.
3. Point out the repository status once indexing completes.
4. If available in the UI, show the repository statistics and indexing information.

### What to say

> “First, ExynoX creates a bounded repository workspace. It reads the source tree, normalizes files and line locations, and builds indexes that can be searched efficiently. For JavaScript and TypeScript repositories, the structural layer parses functions, classes, imports, calls, and related relationships.”

> “The important point is that the repository is indexed before the investigation begins, so the agent can retrieve focused evidence instead of putting the entire codebase into the model context.”

---

## Step 3: Deterministic Code Localization — 45 seconds

**Purpose:** Demonstrate repository search without an AI provider.

### What to show

1. In the question box, enter a repository-specific question such as:

```text
Where is <known function or symbol> defined?
```

2. Click **Ask Codebase**.
3. Show the returned evidence.
4. Point out:
   - File path
   - Exact line range
   - Retrieved code snippet
   - Relevance/evidence information
   - Structural or symbol match, when displayed

### What to say

> “This first query is completely deterministic. ExynoX searches the repository using its retrieval and structural indexes, then returns the actual source location. There is no generated answer that needs to be trusted blindly—the repository evidence is the source of truth.”

### Important demo rule

Use a **real symbol from the repository currently loaded in the application**. Do not use a hard-coded Python example such as `auth/login.py` unless that file actually exists in the repository being demonstrated.

---

## Step 4: Structural Relationship Query — 45 seconds

**Purpose:** Demonstrate that ExynoX understands code relationships rather than only matching text.

### What to show

Ask a relationship question using a real function from the loaded repository:

```text
Who calls <known function>()?
```

or:

```text
What functions does <known function>() call?
```

Then show the resulting structural evidence.

### What to say

> “This is where structural intelligence becomes useful. Instead of only finding the text of the function name, ExynoX can use the parsed code structure to investigate callers, callees, imports, references, and other relationships.”

> “The result is tied back to concrete source locations, so the relationship can be verified directly in the repository.”

---

## Step 5: Activate Agentic AI Investigation — 75 seconds

**Purpose:** Demonstrate the full Theme 1 agentic workflow.

### What to show

1. Open the AI configuration from the application's AI status control.
2. Select the provider available for the demo.
3. Enter the API key securely through the application UI.
4. Activate AI mode.
5. Ask a repository-specific investigation question, for example:

```text
Where is the main data-processing flow implemented, and which functions are involved?
```

6. Show the investigation panel while it runs.

### Highlight the investigation stages

Depending on the repository and current UI, point out the operational events corresponding to:

- Understanding the question
- Planning the investigation
- Searching the repository
- Inspecting candidate files
- Following structural references
- Verifying evidence
- Synthesizing the result

### What to say

> “Now we activate the agentic layer. The model is not simply asked to answer from its general knowledge. ExynoX gives the investigation a controlled workflow: understand the question, plan searches, retrieve candidates, inspect source files, follow relevant relationships, and verify the evidence before synthesis.”

> “The deterministic repository tools remain the source of truth. The AI layer helps decide what to investigate and how to explain the verified findings.”

### Evidence to highlight

Show the final answer and point out:

- Specific repository files
- Exact source locations when available
- Verified evidence
- The explanation connecting the findings

Then say:

> “This makes the final response grounded in the repository rather than being an unsupported code-generation answer.”

---

## Step 6: Evaluation & Reliability — 45 seconds

**Purpose:** Show that the system is measured rather than demonstrated only through screenshots.

### What to show

If the current build exposes the evaluation/benchmark interface, open it and run the available benchmark suite.

Highlight the metrics supported by the implementation, such as:

- **Precision@K**
- **Recall@K**
- **Latency** — including mean/P90 where available
- **Grounding / evidence verification**
- **Indexing statistics and cost-related measurements**

### What to say

> “We also evaluate the retrieval and investigation pipeline quantitatively. The benchmark measures retrieval quality and runtime behavior rather than relying only on a visual demo.”

> “For the hackathon presentation, we report the measurements produced by the current benchmark run and clearly identify the benchmark size and test conditions.”

### Important demo rule

Only quote metric values that are actually produced by the **current build**. Do not present old benchmark numbers as current performance.

---

## Step 7: Security & Deterministic Fallback — 20 seconds

### What to show

1. Return to the AI configuration/status control.
2. Disable AI mode or remove the session key.
3. Show that the application can return to deterministic operation.
4. Return to the repository selection screen if needed.

### What to say

> “Finally, AI is optional. The core repository intelligence remains available in deterministic mode, so the system does not depend on an LLM for every operation.”

> “Provider credentials are supplied through the application session rather than being committed to the repository. API keys and secrets are excluded from source control.”

---

# 5-Minute Timing Plan

| Demo Section | Target Time |
|---|---:|
| Landing page & overview | 0:25 |
| Repository ingestion | 0:30 |
| Deterministic localization | 0:45 |
| Structural relationship query | 0:45 |
| Agentic AI investigation | 1:15 |
| Evaluation & reliability | 0:45 |
| Security & fallback | 0:20 |
| **Total** | **4:45** |

The remaining ~15 seconds provide room for transitions or a brief closing statement.

---

# Closing Statement — 15 seconds

> “ExynoX combines repository indexing, hybrid retrieval, JavaScript and TypeScript structural intelligence, deterministic verification, and an agentic investigation loop into one workflow. The goal is simple: instead of searching through a large codebase manually, developers can ask questions in natural language and receive answers grounded in the actual source code.”

---

# Presenter Checklist

Before recording the final demo:

- [ ] Application starts successfully with `npm run dev`.
- [ ] The prepared repository loads successfully.
- [ ] At least one real function/symbol is known for the deterministic demo.
- [ ] At least one caller/callee relationship is known for the structural demo.
- [ ] AI provider activation has been tested with a valid key.
- [ ] No API key or secret is visible on screen or committed to Git.
- [ ] The investigation panel displays the expected operational events.
- [ ] Evaluation metrics are generated by the current build.
- [ ] Any reported benchmark numbers match the current benchmark run.
- [ ] The final demo fits within five minutes.

---

# Demo Principles

1. **Use real repository evidence.** Never invent file paths, line numbers, functions, or benchmark values during the presentation.
2. **Show deterministic intelligence first.** This establishes that the system has repository-level capabilities even without an LLM.
3. **Use AI for investigation and synthesis.** The agent should orchestrate repository tools rather than replace them.
4. **Keep the evidence visible.** Whenever possible, show the source file and exact location supporting the answer.
5. **Keep the demo reproducible.** The same repository and questions should produce a repeatable workflow.
6. **Be transparent about measurements.** State the benchmark size and conditions when presenting performance results.
