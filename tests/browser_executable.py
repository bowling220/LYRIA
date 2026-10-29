"""Use system Chromium locally, or Playwright’s pinned browser in CI."""
import os,shutil
CHROMIUM=os.environ.get("LYRIA_CHROMIUM") or shutil.which("chromium") or shutil.which("chromium-browser")
