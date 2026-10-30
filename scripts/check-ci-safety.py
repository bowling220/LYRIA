"""Static guardrail for the project's CI contract; GitHub settings enforce approval."""
from pathlib import Path
import re,yaml
for path in Path('.github').rglob('*.yml'):
 yaml.safe_load(path.read_text())
for path in Path('.github/workflows').glob('*.y*ml'):
 source=path.read_text();workflow=yaml.safe_load(source);events=workflow.get('on',workflow.get(True,{}))
 assert set(events)<= {'pull_request','push','workflow_dispatch'},f'Unsafe trigger: {path}'
 assert 'pull_request_target' not in source
 assert workflow.get('permissions')=={'contents':'read'},'CI must be read-only'
 assert not re.search(r'\bsecrets\s*[.\[]|id-token\s*:|environment\s*:|self-hosted|deploy-hook|render\.com/deploy',source,re.I),'CI must not receive deployment authority'
 for job in workflow['jobs'].values():
  assert not job.get('permissions'),'Do not elevate job permissions'
  for step in job.get('steps',[]):
   if 'uses' in step:
    assert re.fullmatch(r'[\w./-]+@[0-9a-f]{40}',step['uses']),'Actions must be pinned to reviewed SHAs'
    if step['uses'].startswith('actions/checkout@'):assert step.get('with',{}).get('persist-credentials') is False
print('CI isolation checks passed. Repository protection settings still require owner setup.')
