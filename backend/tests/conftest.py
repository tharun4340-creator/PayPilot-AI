import os
import tempfile

import pytest

_DB = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ.update({"PAYPILOT_SKIP_DOTENV": "1", "DATABASE_URL": f"sqlite:///{_DB}", "SECRET_KEY": "test-secret-key-test-secret-key-1234",
                   "PAYPAL_CLIENT_ID": "", "PAYPAL_CLIENT_SECRET": "", "PAYPAL_WEBHOOK_ID": "WH-TEST", "LLM_PROVIDER": "", "LLM_API_KEY": ""})
