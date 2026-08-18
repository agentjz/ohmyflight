from __future__ import annotations

import time


def waiting_worker(_config, event_queue, _command_queue):
    event_queue.put({"type": "status", "phase": "waiting_login", "message": "等待扫码"})
    while True:
        time.sleep(0.1)


def staged_worker(_config, event_queue, command_queue):
    if _config.auto_run:
        event_queue.put({"type": "status", "phase": "running", "message": "正在逐人查询"})
        event_queue.put({"type": "completed", "message": "查询完成：成功 0，失败 0"})
    else:
        event_queue.put({"type": "status", "phase": "prepared", "message": "页面已就绪"})
    while True:
        payload = command_queue.get()
        command = payload.get("command")
        if command == "prepare":
            next_config = payload["config"]
            event_queue.put({"type": "status", "phase": "prepared", "message": "页面已就绪"})
            if next_config.auto_run:
                event_queue.put({"type": "status", "phase": "running", "message": "正在逐人查询"})
                event_queue.put({"type": "completed", "message": "查询完成：成功 0，失败 0"})
        elif command == "run":
            event_queue.put({"type": "status", "phase": "running", "message": "正在逐人查询"})
            event_queue.put({"type": "completed", "message": "查询完成：成功 0，失败 0"})
