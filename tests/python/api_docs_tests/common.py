from __future__ import annotations

import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
APP_ROOT = REPOSITORY_ROOT / "public" / "tool" / "app" / "api-docs"
CATALOG_ROOT = APP_ROOT / "catalog"
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))
