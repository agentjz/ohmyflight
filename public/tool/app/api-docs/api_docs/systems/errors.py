class ExecutionError(RuntimeError):
    pass


class SessionExpiredError(ExecutionError):
    pass
