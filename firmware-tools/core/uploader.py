#!/usr/bin/env python3
"""
Electro CODE - Unified uploader for MicroPython / CircuitPython / Arduino
"""
import argparse
import subprocess
import sys
import os

def run(cmd, timeout=30):
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return result.returncode == 0, result.stdout + result.stderr

def upload_micropython(port, file_path, board_id):
    """Upload main.py then soft-reset so it runs immediately."""
    # Upload the file as main.py on the device
    ok, out = run([sys.executable, '-m', 'mpremote', 'connect', port, 'cp', file_path, ':main.py'])
    if not ok:
        # Fallback: try ampy
        ok, out = run([sys.executable, '-m', 'ampy.cli', '--port', port, '--delay', '1', 'put', file_path, 'main.py'])
    if not ok:
        print(f"UPLOAD FAILED: {out}", file=sys.stderr)
        sys.exit(1)

    # Soft reset - this makes the Pico actually RUN the new code
    run([sys.executable, '-m', 'mpremote', 'connect', port, 'reset'])
    print("OK: Uploaded and reset device")

def upload_circuitpython(port, file_path):
    """CircuitPython auto-runs code.py on CIRCUITPY drive."""
    ok, out = run([sys.executable, '-m', 'mpremote', 'connect', port, 'cp', file_path, ':code.py'])
    if not ok:
        ok, out = run([sys.executable, '-m', 'ampy.cli', '--port', port, 'put', file_path, 'code.py'])
    if not ok:
        print(f"UPLOAD FAILED: {out}", file=sys.stderr)
        sys.exit(1)
    run([sys.executable, '-m', 'mpremote', 'connect', port, 'reset'])
    print("OK: Uploaded and reset device")

def upload_arduino(port, file_path, board_id):
    """Compile and flash using arduino-cli."""
    # arduino-cli needs a .ino in a folder matching its name
    import tempfile, shutil
    sketch_name = 'electro_sketch'
    tmpdir = tempfile.mkdtemp()
    sketch_dir = os.path.join(tmpdir, sketch_name)
    os.makedirs(sketch_dir)
    dest = os.path.join(sketch_dir, sketch_name + '.ino')
    shutil.copy(file_path, dest)

    ok, out = run([
        'arduino-cli', 'compile', '--upload',
        '-b', board_id,
        '-p', port,
        sketch_dir
    ], timeout=120)

    shutil.rmtree(tmpdir, ignore_errors=True)
    if not ok:
        print(f"UPLOAD FAILED: {out}", file=sys.stderr)
        sys.exit(1)
    print("OK: Compiled and flashed")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port',     required=True)
    parser.add_argument('--file',     required=True)
    parser.add_argument('--language', required=True,
                        choices=['micropython', 'circuitpython', 'arduino', 'c'])
    parser.add_argument('--board-id', default='arduino:avr:uno')
    args = parser.parse_args()

    if args.language == 'micropython':
        upload_micropython(args.port, args.file, args.board_id)
    elif args.language == 'circuitpython':
        upload_circuitpython(args.port, args.file)
    elif args.language in ('arduino', 'c'):
        upload_arduino(args.port, args.file, args.board_id)