from __future__ import annotations

import argparse
import webbrowser
from pathlib import Path

from lock_entry.server import create_server


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="启动锁班皇帝智能串行工作台")
    parser.add_argument("--port", type=int, default=0, help="本地端口，默认随机分配")
    parser.add_argument("--no-open", action="store_true", help="不自动打开工作台页面")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    app_directory = Path(__file__).resolve().parent
    server = create_server(app_directory, "smart", args.port)
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/"
    print(f"锁班皇帝（智能串行）：{url}")
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n锁班皇帝已关闭。")
    finally:
        server.run_manager.shutdown()  # type: ignore[attr-defined]
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
