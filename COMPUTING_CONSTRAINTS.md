# Computing Constraints

## System Specifications

| Property | Value |
|---|---|
| OS | macOS |
| Chip | Apple Silicon M2 |
| RAM | 8GB unified memory |
| GPU | Integrated M2 GPU (shared with unified memory pool) |
| IDE | VS Code |

## What This Means for Machine Learning

### Memory
- 8GB unified memory is shared between CPU, GPU, and the OS
- In practice, roughly 4–5GB is available for active ML workloads
- Large datasets, wide param grids, and high n_estimators can cause memory pressure
- Avoid loading multiple large models or datasets into memory simultaneously

### CPU
- M2 has 8 cores (4 performance + 4 efficiency)
- scikit-learn's `n_jobs=-1` will use all 8 cores — always set this
- CPU-bound tasks (GridSearchCV, RandomizedSearchCV) benefit significantly from parallelism on M2

### GPU
- M2's integrated GPU is not natively used by scikit-learn
- For scikit-learn workflows, treat this as a CPU-only machine
- GPU acceleration is available via TensorFlow-metal or PyTorch MPS backends if needed in future

---

## Optimization Rules for This Machine

### Cross-Validation
- Use `n_splits=3` during tuning and exploration phases
- Only increase to `n_splits=5` for final model evaluation
- Prefer `StratifiedKFold` for classification to maximize signal per fold

### Hyperparameter Search
- Always prefer `RandomizedSearchCV` over `GridSearchCV`
- Keep `n_iter` between 10 and 20 during early tuning phases
- Always set `n_jobs=-1` to use all M2 cores
- Keep `n_estimators` at 50–100 during search; increase only for the final model

### Dataset Size During Tuning
- If training data exceeds 5,000 rows, consider sampling 2,500–3,000 rows for the search phase
- Run final evaluation on the full training set once best params are identified

### Recommended param_grid Sizing
- Limit to 2–3 hyperparameters per search
- Keep each hyperparameter to 3–4 values maximum during early phases
- Target no more than 10–20 total combinations in any single search

### Algorithm Comparison
- Use `n_estimators=50` and `n_splits=3` when comparing algorithms at baseline
- Only tune the winning algorithm — don't tune all candidates

---

## Quick Reference: Safe Starting Settings

```python
# Cross-validation
skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=27)

# Randomized search
RandomizedSearchCV(
    estimator=model,
    param_distributions=param_dist,
    n_iter=15,
    cv=skf,
    scoring="roc_auc",
    n_jobs=-1,        # uses all 8 M2 cores
    random_state=27
)

# Baseline algorithm comparison
RandomForestClassifier(n_estimators=50, n_jobs=-1, random_state=27)
GradientBoostingClassifier(n_estimators=50, random_state=27)
```

---

## Notes for Claude Code
- This machine has limited RAM — avoid wide grids and high estimator counts during search
- Always recommend `n_jobs=-1` for any parallelizable scikit-learn operation
- Suggest sampling large datasets before tuning
- Default to `RandomizedSearchCV` over `GridSearchCV` unless the search space is very small (under 12 total combinations)
- When suggesting n_estimators for a final model, cap recommendations at 300 unless there is a strong reason to go higher
