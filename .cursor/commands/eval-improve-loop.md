---
name: eval-improve-loop
description: Run continuous eval → audit → fix → re-run loop until no more issues are found
argument-hint: Number of iterations (default 10)
---

# Continuous Eval Improvement Loop

Run the eval → audit → fix → re-run cycle for `$ARGUMENTS` iterations (default 10).
Each iteration: run full CI evals, analyze failures + audit both repos, fix all issues found, re-run.
Stop early if two consecutive runs produce the same perfect score (convergence).

## Execution Steps

### 1. Setup

```bash
cd $WORKSPACE_ROOT
npm run build
```

Load environment:
```bash
export $(grep -v '^#' .env.test | xargs) 2>/dev/null
export $(grep -v '^#' ../cursor-plugin-evals/.env | xargs) 2>/dev/null
```

### 2. For each iteration (1 to N):

#### 2a. Run full CI evals
```bash
npx cursor-plugin-evals run --config plugin-eval.yaml --ci --verbose
```

#### 2b. If exit code is 0 and no failures:
- Run a deep audit of BOTH repos:
  - Check for new dead code, type issues, missing validation, stale docs
  - Check for evaluator false positives/negatives  
  - Check for tool description improvements
  - Check for new coverage gaps from recent changes
  - Check for DRY violations, swallowed errors, unsafe casts
- If audit finds issues → fix them, rebuild, continue to next iteration
- If audit finds nothing → convergence reached, stop

#### 2c. If exit code is non-zero:
- Read failure details from the output
- Classify each failure:
  | Type | Fix Strategy |
  |------|-------------|
  | Config issue (wrong expected value) | Fix plugin-eval.yaml |
  | Evaluator false positive | Fix evaluator in cursor-plugin-evals |
  | Tool bug (wrong output, missing validation) | Fix tool in elastic-cursor-plugin |
  | LLM routing issue (wrong tool selected) | Improve tool description or test prompt |
  | Infrastructure issue | Add require_env or increase timeout |
  | Flaky test | Remove unstable evaluator or increase repetitions |
  | CI threshold too strict | Relax threshold (last resort) |
- Apply ALL fixes
- Rebuild both repos if framework was changed
- Continue to next iteration

#### 2d. Steady state detection
- Track pass rates across iterations
- If same score 2 runs in a row with 100% pass → converged
- If same failures persist 3 runs in a row → change approach or report

### 3. After loop completes

#### 3a. Threshold calibration
Compare actual scores vs thresholds. Tighten any with >10% headroom.

#### 3b. Commit and push
Commit changes to BOTH repos with descriptive messages explaining what was fixed.

#### 3c. Final report
```markdown
## Continuous Improvement Results

**Iterations:** N
**Final pass rate:** 100% (97/97)
**CI status:** All thresholds passing

### Changes made:
- [Framework] ...
- [Plugin] ...

### Remaining known issues:
- None / list any that couldn't be auto-fixed
```

## Key Rules
- Fix BOTH the framework and the plugin — don't just work around framework limitations
- Never remove tests — fix them or skip with documented reason  
- Always rebuild after changes before re-running
- Security thresholds (min: 1.0) are never lowered
- Max 5 fix attempts for the same failure before changing approach
- Commit after each successful convergence, not after each fix
