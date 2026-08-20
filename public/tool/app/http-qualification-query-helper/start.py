from __future__ import annotations

import argparse
import webbrowser
from pathlib import Path

from http_qualification_query.server import create_server


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="启动飞行人员信息查询（皇帝版）")
    parser.add_argument("--port", type=int, default=0, help="本地端口，默认随机分配")
    parser.add_argument("--no-open", action="store_true", help="不自动打开浏览器")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    app_directory = Path(__file__).resolve().parent
    server = create_server(app_directory, args.port)
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/"
    print(f"飞行人员信息查询（皇帝版）：{url}")
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n飞行人员信息查询（皇帝版）已关闭。")
    finally:
        server.run_manager.shutdown()  # type: ignore[attr-defined]
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
