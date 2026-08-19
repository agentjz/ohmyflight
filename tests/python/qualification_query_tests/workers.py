from __future__ import annotations


def staged_worker(config, event_queue, command_queue):
    event_queue.put({"type": "status", "phase": "prepared", "message": "资料管理页面已就绪"})
    if config.auto_run:
        event_queue.put({"type": "completed", "message": "查询完成", "total": 1, "success": 1, "failed": 0})
    while True:
        command = command_queue.get()
        name = command.get("command", "") if isinstance(command, dict) else command
        if name == "prepare":
            event_queue.put({"type": "status", "phase": "prepared", "message": "下一批数据已准备"})
        elif name == "run":
            event_queue.put({"type": "completed", "message": "查询完成", "total": 1, "success": 1, "failed": 0})


def waiting_worker(_config, event_queue, _command_queue):
    import time

    event_queue.put({"type": "status", "phase": "prepared", "message": "资料管理页面已就绪"})
    while True:
        time.sleep(0.1)

