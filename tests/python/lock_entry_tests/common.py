from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
APP_DIR = ROOT / "public" / "tool" / "app" / "lock-entry-helper"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))
