from __future__ import annotations

from pathlib import Path


def waiting_worker(_config, event_queue, command_queue):
    event_queue.put({"type": "status", "phase": "waiting_login", "message": "等待测试"})
    while True:
        command_queue.get()


def staged_worker(config, event_queue, command_queue):
    current_config = config
    event_queue.put({"type": "status", "phase": "prepared", "message": "测试页面已就绪"})

    def complete_batch():
        output = Path(current_config.output_directory) / "result.xlsx"
        output.write_bytes(b"test")
        event_queue.put(
            {
                "type": "completed",
                "message": "测试录入完成",
                "total": 1,
                "success": 1,
                "failed": 0,
                "path": str(output),
            }
        )

    if current_config.auto_run:
        complete_batch()
    while True:
        command = command_queue.get()
        if command.get("command") == "prepare":
            current_config = command["config"]
            event_queue.put({"type": "status", "phase": "prepared", "message": "测试页面已复用"})
            if current_config.auto_run:
                complete_batch()
        elif command.get("command") == "run":
            complete_batch()
