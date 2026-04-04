#!/usr/bin/env python3
"""
Electro CODE - Unified uploader for MicroPython / CircuitPython / Arduino
Supports: flash and run modes across multiple board types.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
import serial

# ─────────────────────────────────────────────
#  Exit codes (so Electron can handle them cleanly)
# ─────────────────────────────────────────────
EXIT_OK            = 0
EXIT_UPLOAD_FAILED = 1
EXIT_PORT_BUSY     = 2
EXIT_PORT_MISSING  = 3
EXIT_FILE_MISSING  = 4
EXIT_TIMEOUT       = 5
EXIT_TOOL_MISSING  = 6
EXIT_UNKNOWN       = 9


# ─────────────────────────────────────────────
#  Hardware Helper: Wait for Port
# ─────────────────────────────────────────────
def wait_for_port(port: str, timeout: float = 3.0) -> bool:
    """
    Attempt to open the port multiple times. 
    Returns True if port becomes available, False otherwise.
    """
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            # Try to open port to see if it's free
            s = serial.Serial(port, 115200, timeout=1)
            s.close()
            return True
        except (serial.SerialException, OSError) as e:
            if "Access is denied" in str(e) or "PermissionError" in str(e):
                time.sleep(0.3) # Wait and retry
                continue
            # If it's a "Device not found", it might be really gone
            return False
    return False


# ─────────────────────────────────────────────
#  Output helpers  (stdout = progress / result,
#                   stderr = errors)
# ─────────────────────────────────────────────
def info(msg: str) -> None:
    """Progress / status message — read by Electron."""
    print(f"INFO: {msg}", flush=True)

def ok(msg: str) -> None:
    """Final success message — Electron looks for 'OK:' prefix."""
    print(f"OK: {msg}", flush=True)

def die(msg: str, code: int = EXIT_UPLOAD_FAILED) -> None:
    """Print a clean error to stderr and exit with a specific code."""
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(code)


# ─────────────────────────────────────────────
#  Pre-flight validation
# ─────────────────────────────────────────────
def validate_inputs(port: str, file_path: str) -> None:
    """Validate port and file exist before doing anything."""
    if not file_path or not os.path.isfile(file_path):
        die(f"Source file not found: '{file_path}'", EXIT_FILE_MISSING)

    if not file_path.endswith(('.py', '.ino', '.c', '.cpp')):
        # Warn but don't block — user might have an unusual extension
        info(f"Warning: Unexpected file extension for '{os.path.basename(file_path)}'")

    if not port:
        die("No port specified. Connect a device and select a port.", EXIT_PORT_MISSING)


def check_tool(tool_module: str, friendly_name: str) -> None:
    """Verify a Python-module CLI tool is importable/installed."""
    result = subprocess.run(
        [sys.executable, '-m', tool_module, '--version'],
        capture_output=True, text=True
    )
    if result.returncode != 0 and 'No module named' in (result.stderr or ''):
        die(
            f"Required tool '{friendly_name}' is not installed.\n"
            f"  Fix: pip install {friendly_name.lower()}",
            EXIT_TOOL_MISSING
        )


# ─────────────────────────────────────────────
#  Subprocess wrapper
# ─────────────────────────────────────────────
def run(cmd: list, timeout: int = 30) -> tuple[bool, str]:
    """
    Run a subprocess and return (success, combined_output).
    Never raises — all errors are returned as (False, message).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        combined = (result.stdout + result.stderr).strip()
        return result.returncode == 0, combined

    except subprocess.TimeoutExpired:
        return False, f"Command timed out after {timeout}s: {' '.join(cmd)}"
    except FileNotFoundError:
        return False, f"Executable not found: '{cmd[0]}'"
    except PermissionError:
        return False, f"Permission denied running: '{cmd[0]}'"
    except Exception as exc:
        return False, f"Unexpected error: {exc}"


def run_streaming(cmd: list) -> int:
    """
    Run a subprocess with output streamed directly to the terminal.
    Returns the exit code.
    """
    try:
        return subprocess.call(cmd)
    except FileNotFoundError:
        die(f"Executable not found: '{cmd[0]}'", EXIT_TOOL_MISSING)
    except Exception as exc:
        die(f"Failed to launch process: {exc}")


# ─────────────────────────────────────────────
#  Error parser
# ─────────────────────────────────────────────
def parse_upload_error(port: str, output: str) -> None:
    """
    Map raw tool output to a clean, actionable error message and exit.
    Checks most-specific patterns first.
    """
    out_lower = output.lower()

    if "access is denied" in out_lower or "permission denied" in out_lower:
        die(
            f"Port '{port}' is in use by another program (e.g. Thonny, Arduino IDE, PuTTY).\n"
            f"  Fix: Close the other program, then try again.",
            EXIT_PORT_BUSY
        )

    if any(p in out_lower for p in ("no such file", "device not found", "could not open port", "no port")):
        die(
            f"Device not found on port '{port}'.\n"
            f"  Fix: Check the USB cable, reconnect the device, and verify the port.",
            EXIT_PORT_MISSING
        )

    if "timed out" in out_lower or "timeout" in out_lower:
        die(
            f"Connection to '{port}' timed out.\n"
            f"  Fix: The device may be busy or in an infinite loop. Try pressing RESET.",
            EXIT_TIMEOUT
        )

    if "no module named" in out_lower:
        tool = output.split("No module named")[-1].strip().strip("'\"")
        die(
            f"Required Python module '{tool}' is not installed.\n"
            f"  Fix: pip install {tool}",
            EXIT_TOOL_MISSING
        )

    if "invalid syntax" in out_lower or "syntaxerror" in out_lower:
        die(
            f"Syntax error in your code. Fix the error and try uploading again.\n"
            f"  Detail: {_last_line(output)}",
            EXIT_UPLOAD_FAILED
        )

    if "memory" in out_lower or "memoryerror" in out_lower:
        die(
            f"Device ran out of memory during upload.\n"
            f"  Fix: Free space on the device or reduce code size.",
            EXIT_UPLOAD_FAILED
        )

    # Generic fallback — show the last meaningful line from the tool
    detail = _last_line(output)
    die(f"Upload failed: {detail}", EXIT_UPLOAD_FAILED)


def _last_line(text: str) -> str:
    """Return the last non-empty line of a string."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return lines[-1] if lines else "(no output from tool)"


# ─────────────────────────────────────────────
#  MicroPython uploader
# ─────────────────────────────────────────────
def upload_micropython(port: str, file_path: str, board_id: str,
                       device_name: str | None = None, mode: str = 'flash') -> None:

    # ⏳ Robustness Check: Ensure the port is free, wait if not (Windows contention)
    if not wait_for_port(port):
        die(f"Could not open {port}. Device might be busy or in use by another session.", EXIT_PORT_BUSY)

    target_name = device_name or 'main.py'
    base = os.path.basename(file_path)

    if mode == 'run':
        info(f"Running '{base}' on device (not saved to flash) ...")
        cmd = [sys.executable, '-m', 'mpremote', 'connect', port, 'run', file_path]
        ret = run_streaming(cmd)
        sys.exit(ret)

    # ── Flash mode ──
    info(f"Uploading '{base}' → '{target_name}' via mpremote ...")
    ok_flag, out = run([
        sys.executable, '-m', 'mpremote',
        'connect', port,
        'cp', file_path, f':{target_name}',
        'reset'
    ])

    if not ok_flag:
        info("mpremote failed, trying ampy fallback ...")
        ok_flag, out = run([
            sys.executable, '-m', 'ampy.cli',
            '--port', port, '--delay', '1',
            'put', file_path, target_name
        ])
        if ok_flag:
            # ampy doesn't reset automatically
            run([sys.executable, '-m', 'mpremote', 'connect', port, 'reset'])

    if not ok_flag:
        parse_upload_error(port, out)

    ok(f"Uploaded '{target_name}' and reset device")


# ─────────────────────────────────────────────
#  CircuitPython uploader
# ─────────────────────────────────────────────
def upload_circuitpython(port: str, file_path: str,
                         device_name: str | None = None, mode: str = 'flash') -> None:

    target_name = device_name or 'code.py'
    base = os.path.basename(file_path)

    if mode == 'run':
        info(f"Running '{base}' on device (not saved to flash) ...")
        cmd = [sys.executable, '-m', 'mpremote', 'connect', port, 'run', file_path]
        ret = run_streaming(cmd)
        sys.exit(ret)

    # ── Flash mode ──
    info(f"Uploading '{base}' → '{target_name}' via mpremote ...")
    ok_flag, out = run([
        sys.executable, '-m', 'mpremote',
        'connect', port,
        'cp', file_path, f':{target_name}',
        'reset'
    ])

    if not ok_flag:
        info("mpremote failed, trying ampy fallback ...")
        ok_flag, out = run([
            sys.executable, '-m', 'ampy.cli',
            '--port', port,
            'put', file_path, target_name
        ])

    if not ok_flag:
        parse_upload_error(port, out)

    ok(f"Uploaded '{target_name}' to device")


# ─────────────────────────────────────────────
#  Arduino uploader
# ─────────────────────────────────────────────
def upload_arduino(port: str, file_path: str, board_id: str) -> None:

    # Verify arduino-cli is on PATH
    if not shutil.which('arduino-cli'):
        die(
            "arduino-cli not found on PATH.\n"
            "  Fix: Install from https://arduino.github.io/arduino-cli/",
            EXIT_TOOL_MISSING
        )

    base = os.path.basename(file_path)
    sketch_name = 'electro_sketch'
    tmpdir = tempfile.mkdtemp(prefix='electrocode_')

    try:
        sketch_dir = os.path.join(tmpdir, sketch_name)
        os.makedirs(sketch_dir)
        dest = os.path.join(sketch_dir, sketch_name + '.ino')
        shutil.copy(file_path, dest)

        info(f"Compiling '{base}' for board '{board_id}' ...")
        ok_flag, out = run([
            'arduino-cli', 'compile', '--upload',
            '-b', board_id,
            '-p', port,
            sketch_dir
        ], timeout=180)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if not ok_flag:
        if "access is denied" in out.lower() or "permission denied" in out.lower():
            die(
                f"Port '{port}' is busy. Close Arduino IDE or any serial monitor.",
                EXIT_PORT_BUSY
            )
        if "no such file" in out.lower() or "could not open port" in out.lower():
            die(f"Device not found on port '{port}'. Reconnect and try again.", EXIT_PORT_MISSING)
        if "board" in out.lower() and "not found" in out.lower():
            die(
                f"Board '{board_id}' is not installed in arduino-cli.\n"
                f"  Fix: arduino-cli core install <platform>",
                EXIT_UPLOAD_FAILED
            )
        die(f"Compile/upload failed:\n{_last_line(out)}", EXIT_UPLOAD_FAILED)

    ok(f"Compiled and flashed '{base}' to {port}")


# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Electro CODE — firmware uploader',
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument('--port',        required=True,  help='Serial port (e.g. COM3 or /dev/ttyUSB0)')
    parser.add_argument('--file',        required=True,  help='Path to source file')
    parser.add_argument('--language',    required=True,
                        choices=['micropython', 'circuitpython', 'arduino', 'c'],
                        help='Target language / runtime')
    parser.add_argument('--board-id',    default='arduino:avr:uno',
                        help='Arduino board FQBN (e.g. arduino:avr:uno)')
    parser.add_argument('--device-name', default=None,
                        help='Destination filename on device (default: main.py / code.py)')
    parser.add_argument('--mode',        default='flash', choices=['flash', 'run'],
                        help='flash = save to device,  run = execute without saving')
    args = parser.parse_args()

    # ── Validate before touching the device ──
    validate_inputs(args.port, args.file)

    # ── Dispatch ──
    if args.language == 'micropython':
        upload_micropython(args.port, args.file, args.board_id, args.device_name, args.mode)

    elif args.language == 'circuitpython':
        upload_circuitpython(args.port, args.file, args.device_name, args.mode)

    elif args.language in ('arduino', 'c'):
        if args.mode == 'run':
            die("Run mode is not supported for Arduino/C. Use 'flash' instead.", EXIT_UPLOAD_FAILED)
        upload_arduino(args.port, args.file, args.board_id)