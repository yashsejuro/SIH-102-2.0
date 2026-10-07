import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

BACKEND_PORT = "8001"
FRONTEND_PORT = "5173"
processes = []

def start_process(name, command, cwd):
    print(f"[START] {name}: {' '.join(command)}")
    p = subprocess.Popen(command, cwd=str(cwd))
    processes.append((name, p))

def cleanup():
    print("\n[STOP] Stopping frontend and backend...")
    for _, p in reversed(processes):
        if p.poll() is None:
            try:
                if os.name == "nt":
                    p.send_signal(signal.CTRL_BREAK_EVENT)
                else:
                    p.terminate()
            except Exception:
                try: p.kill()
                except Exception: pass
    time.sleep(1)
    for _, p in processes:
        if p.poll() is None:
            try: p.kill()
            except Exception: pass

def main():
    if not BACKEND.exists() or not FRONTEND.exists():
        print("[ERROR] Expected backend and frontend folders beside start.py.")
        sys.exit(1)
    backend_python = BACKEND / ".venv" / "Scripts" / "python.exe"
    if not backend_python.exists():
        print(f"[ERROR] Backend Python not found: {backend_python}")
        print("Create the backend .venv with Python 3.12 first.")
        sys.exit(1)
    print("=" * 60)
    print("       MPLADS AUDIT INTELLIGENCE - STARTUP")
    print("=" * 60)
    try:
        start_process("Backend", [str(backend_python), "-m", "uvicorn", "app.main:app", "--reload", "--port", BACKEND_PORT], BACKEND)
        time.sleep(2)
        start_process("Frontend", ["npm.cmd", "run", "dev", "--", "--port", FRONTEND_PORT], FRONTEND)
        print(f"\nBackend:  http://127.0.0.1:{BACKEND_PORT}")
        print(f"Frontend: http://127.0.0.1:{FRONTEND_PORT}")
        print("\nBoth services are running. Press Ctrl+C to stop both.")
        while True: time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally: cleanup()

if __name__ == "__main__": main()
