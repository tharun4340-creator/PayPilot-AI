class AppError(Exception):
    """An error whose message is safe and friendly to show to the user."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
