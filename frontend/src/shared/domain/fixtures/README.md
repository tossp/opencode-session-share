# Real share fixture

- Captured shape only; the full API payload is intentionally not committed.
- Trimmed from the real sample by keeping representative `session`, `message`, `part`, `session_diff`, and `model` items plus their observed field shapes.
- Duplicate `session`, `message`, and `part` entries are intentional so later normalization tests can verify merge/replace behavior.
- Unknown top-level and unknown part subtype entries are synthetic resilience rows, shaped like `{ type, data }`, to ensure future code keeps forward compatibility.
- Large text, full command output, full patches, repeated models, and unrelated session history were removed to keep this directory under 100KB.
