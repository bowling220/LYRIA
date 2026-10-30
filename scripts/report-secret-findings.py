"""Print actionable scanner metadata without printing matched secrets or source lines."""
from pathlib import Path
import json,sys
report=Path(sys.argv[1])
if not report.exists():
 print('Secret scan report was not generated; inspect the scanner step.')
 raise SystemExit(0)
findings=json.loads(report.read_text())
print('Secret scan findings:',len(findings))
for finding in findings:
 print(json.dumps({key:finding.get(key) for key in ['RuleID','File','StartLine','Commit','Fingerprint']},ensure_ascii=True))
