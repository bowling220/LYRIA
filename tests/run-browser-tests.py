"""Run all isolated browser/voice suites; never production accounts."""
from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parents[1]
names=['news','sidebar-feedback','hub','panel-restore','location-restore','invites','ui','gif','badges','appearance-reactions','product-access','reload','social-loading','channel-selection','voice-ui','call-view','voice-transport','call-invites','voice']
for name in names:
 print('Running '+name,flush=True)
 result=subprocess.run([sys.executable,str(root/'tests'/f'{name}-smoke.py')],cwd=root)
 if result.returncode:sys.exit(result.returncode)
