"""Install two pinned upstream security/CI tools; archives must match reviewed SHA256."""
import hashlib,io,pathlib,tarfile,urllib.request
out=pathlib.Path('.ci-tools');out.mkdir(exist_ok=True)
releases=[('gitleaks','https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz','551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'),('actionlint','https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz','8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8')]
for name,url,expected in releases:
 data=urllib.request.urlopen(url,timeout=60).read()
 if hashlib.sha256(data).hexdigest()!=expected:raise RuntimeError('Checksum mismatch: '+name)
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
  member=archive.getmember(name)
  if not member.isfile():raise RuntimeError('Invalid archive member')
  content=archive.extractfile(member).read()
 target=out/name;target.write_bytes(content);target.chmod(0o755)
 print('Installed verified '+name)
