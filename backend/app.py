from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from storage import add_expense, calculate_stats, delete_expense, ensure_workbook, list_expenses


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
HOST = "127.0.0.1"
PORT = 8000


class ExpenseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/api/expenses":
            expenses = list_expenses()
            self._send_json({"expenses": expenses})
            return

        if parsed.path == "/api/stats":
            expenses = list_expenses()
            self._send_json(calculate_stats(expenses))
            return

        if parsed.path == "/":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/expenses":
            self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found")
            return

        try:
            payload = self._read_json_body()
            created = add_expense(payload)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        except json.JSONDecodeError:
            self._send_json({"error": "invalid JSON body"}, status=HTTPStatus.BAD_REQUEST)
            return

        self._send_json(created, status=HTTPStatus.CREATED)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/expenses/"):
            self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found")
            return

        expense_id = parsed.path.rsplit("/", 1)[-1]
        if not expense_id:
            self._send_json({"error": "expense id is required"}, status=HTTPStatus.BAD_REQUEST)
            return

        deleted = delete_expense(expense_id)
        if not deleted:
            self._send_json({"error": "expense not found"}, status=HTTPStatus.NOT_FOUND)
            return

        self._send_json({"deleted": True})

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length).decode("utf-8")
        return json.loads(raw_body or "{}")

    def _send_json(self, payload, status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def run() -> None:
    ensure_workbook()
    server = ThreadingHTTPServer((HOST, PORT), ExpenseHandler)
    print(f"Serving on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
