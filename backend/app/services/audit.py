from app.models import AuditLog, Notification


def log_action(db, user_id, action: str, details: str = "", ip: str = None) -> None:
    db.add(AuditLog(user_id=user_id, action=action, details=details[:1000], ip=ip))


def notify(db, user_id: int, title: str, body: str, level: str = "info") -> None:
    db.add(Notification(user_id=user_id, title=title[:160], body=body, level=level))
