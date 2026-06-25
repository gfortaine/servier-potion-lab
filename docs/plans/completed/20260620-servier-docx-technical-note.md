# Plan: SERVIER docx technical note

## Overview
Produce a professional French Word document for the SERVIER benchmark slice in this strategy worktree only. Do not fetch the Free-Work URL live; use only the frozen benchmark brief and local docs.

## Context
- Benchmark brief: /Users/gfortaine/Workspace/FORTAINE Software/Workspace/MachineMates/loops/servier-loop-harness-benchmark/spec/docx-benchmark-brief.md
- Read-only source docs: docs/architecture.md and docs/azure-deployment.md
- Target: docs/note-technique-servier-architecture-ia.docx
- Required phrase groups: monolithe, miniservices, Turborepo, IA opérationnelle, modernisation, week-end
- Do not modify docs/architecture.md or docs/azure-deployment.md.

## Validation Commands
- `python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile
import re
p=Path('docs/note-technique-servier-architecture-ia.docx')
assert p.exists(), p
with ZipFile(p) as zf:
    xml=zf.read('word/document.xml').decode('utf-8')
text=re.sub(r'<[^>]+>',' ',xml)
text=re.sub(r'\s+',' ',text).strip().lower()
for phrase in ['monolithe','miniservices','turborepo','ia opérationnelle','modernisation','week-end']:
    assert phrase in text, phrase
print('docx validation ok')
PY`

### Task 1: Generate SERVIER docx technical note
- [x] Read the frozen benchmark brief and source docs.
- [x] Generate a valid OOXML .docx at docs/note-technique-servier-architecture-ia.docx in French.
- [x] Ensure extracted text includes all required phrase groups.
- [x] Leave protected source docs unchanged.
