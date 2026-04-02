#!/usr/bin/env python3
"""
Electro CODE - Unified uploader for MicroPython / CircuitPython / Arduino
"""
import argparse
import subprocess
import sys
import os

def run(cmd, timeout=30):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, str(e)

def handle_error(port, out):
    """Parses output for common errors and prints friendly messages."""
    if "Access is denied" in out:
        print(f"ERROR: Port {port} is used by another program (e.g. Thonny).", file=sys.stderr)
    elif "No such file" in out or "device not found" in out or "could not open port" in out:
        print(f"ERROR: Device disconnected or port {port} not found.", file=sys.stderr)
    else:
        # Show actual output but keep it clean
        msg = out.split('\n')[-2] if len(out.split('\n')) > 1 else out
        print(f"UPLOAD FAILED: {msg.strip()}", file=sys.stderr)
    sys.stdout.flush()
    sys.stderr.flush()
    sys.exit(1)

def upload_micropython(port, file_path, board_id, device_name=None, mode='flash'):
    """Upload or Run file. If mode is 'run', it executes code without saving to flash."""
    
    if mode == 'run':
        print(f"OK: Code is starting on device (not saved to flash)")
        sys.stdout.flush()
        
        # Use subprocess.call so output streams directly to Electron's pipe
        cmd = [sys.executable, '-m', 'mpremote', 'connect', port, 'run', file_path]
        ret = subprocess.call(cmd)
        if ret != 0:
            sys.exit(ret)
        sys.exit(0)
    else:
        # Flash / Upload mode
        target_name = device_name or 'main.py'
        # Chain commands: connect -> cp -> reset
        ok, out = run([sys.executable, '-m', 'mpremote', 'connect', port, 'cp', file_path, f':{target_name}', 'reset'])
        
        if not ok:
            # Fallback: try ampy
            ok, out = run([sys.executable, '-m', 'ampy.cli', '--port', port, '--delay', '1', 'put', file_path, target_name])
            if ok:
                # Manual reset for ampy fallback
                run([sys.executable, '-m', 'mpremote', 'connect', port, 'reset'])
        
        if not ok:
            handle_error(port, out)
        print(f"OK: Uploaded {target_name} and reset device")
        sys.stdout.flush()

def upload_circuitpython(port, file_path, device_name=None, mode='flash'):
    """Upload or Run file for CircuitPython."""
    target_name = device_name or 'code.py'
    
    if mode == 'run':
        print(f"OK: Code is starting on device")
        sys.stdout.flush()
        
        # Use subprocess.call so output streams directly to Electron's pipe
        cmd = [sys.executable, '-m', 'mpremote', 'connect', port, 'run', file_path]
        ret = subprocess.call(cmd)
        if ret != 0:
            sys.exit(ret)
        sys.exit(0)
    else:
        ok, out = run([sys.executable, '-m', 'mpremote', 'connect', port, 'cp', file_path, f':{target_name}', 'reset'])
        if not ok:
            ok, out = run([sys.executable, '-m', 'ampy.cli', '--port', port, 'put', file_path, target_name])
        if not ok:
            handle_error(port, out)
        print(f"OK: Uploaded {target_name}")

def upload_arduino(port, file_path, board_id):
    """Compile and flash using arduino-cli."""
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
        if "Access is denied" in out:
             print(f"ERROR: Port {port} is busy.", file=sys.stderr)
        else:
             print(f"UPLOAD FAILED: {out}", file=sys.stderr)
        sys.exit(1)
    print("OK: Compiled and flashed")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port',        required=True)
    parser.add_argument('--file',        required=True)
    parser.add_argument('--language',    required=True,
                        choices=['micropython', 'circuitpython', 'arduino', 'c'])
    parser.add_argument('--board-id',    default='arduino:avr:uno')
    parser.add_argument('--device-name', default=None)
    parser.add_argument('--mode',        default='flash', choices=['flash', 'run'])
    args = parser.parse_args()

    if args.language == 'micropython':
        upload_micropython(args.port, args.file, args.board_id, args.device_name, args.mode)
    elif args.language == 'circuitpython':
        upload_circuitpython(args.port, args.file, args.device_name, args.mode)
    elif args.language in ('arduino', 'c'):
        upload_arduino(args.port, args.file, args.board_id)