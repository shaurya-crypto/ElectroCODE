import argparse
import subprocess
import sys
import json
import time

def run_cmd(cmd, timeout=15):
    """Run a command and return stripped stdout. Exits on failure."""
    for attempt in range(5):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            if result.returncode == 0:
                break
            time.sleep(1)
        except subprocess.TimeoutExpired:
            if attempt == 4:
                print(json.dumps({"error": "Command timed out"}))
                sys.exit(1)
            time.sleep(1)

    if result.returncode != 0:
        err_msg = result.stderr.strip() or result.stdout.strip() or "Command failed"
        print(json.dumps({"error": err_msg}))
        sys.exit(1)

    out = result.stdout.strip()

    # Strip mpremote connection garbage by finding the first JSON char
    start_list = out.find('[')
    start_dict = out.find('{')

    if start_list == -1 and start_dict == -1:
        return out

    if start_list == -1: idx = start_dict
    elif start_dict == -1: idx = start_list
    else: idx = min(start_list, start_dict)

    return out[idx:]

def list_files(port, target_path=""):
    """Runs code on the Pico to get its files formatted as JSON."""
    mpy_code = f"""import os, json
try:
    path = {repr(target_path)} if {repr(target_path)} else '.'
    items = []
    for f in os.listdir(path):
        try:
            stat = os.stat(path + '/' + f)
            is_dir = (stat[0] & 0x4000) != 0
            items.append({{"name": f, "type": "folder" if is_dir else "file"}})
        except:
            items.append({{"name": f, "type": "file"}})
    print(json.dumps(items))
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
"""
    cmd = [sys.executable, "-m", "mpremote", "connect", port, "exec", mpy_code]
    output = run_cmd(cmd)
    print(output)

def strip_leading_slash(path):
    return path.lstrip('/') if path else path

def read_file(port, filename):
    filename = filename.lstrip("/")

    cmd = [
        sys.executable, "-m", "mpremote",
        "connect", port,
        "fs", "cat", filename
    ]

    try:
        for attempt in range(5):
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",     # ✅ FIX
                errors="ignore",      # ✅ VERY IMPORTANT
                timeout=15
            )
            if result.returncode == 0:
                break
            time.sleep(1)

        if result.returncode != 0:
            print(json.dumps({"error": result.stderr.strip() or "Failed to read file"}))
            return

        out = result.stdout or ""   # ✅ avoid None crash

        # Clean "Connected to ..." line
        lines = out.splitlines()
        if lines and "Connected to" in lines[0]:
            content = "\n".join(lines[1:])
        else:
            content = out

        print(json.dumps({"content": content}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

def delete_file(port, filename):
    """Uses mpremote 'rm' to delete a file."""
    filename = strip_leading_slash(filename)
    cmd = [sys.executable, "-m", "mpremote", "connect", port, "rm", filename]
    run_cmd(cmd)
    print(json.dumps({"success": True}))

def rename_file(port, old_path, new_path):
    """Uses mpremote 'fs mv' to rename a file or folder on the device."""
    old_path = strip_leading_slash(old_path)
    new_path = strip_leading_slash(new_path)
    # mpremote fs mv :old :new
    cmd = [sys.executable, "-m", "mpremote", "connect", port, "fs", "mv", f":{old_path}", f":{new_path}"]
    run_cmd(cmd)
    print(json.dumps({"success": True}))

def write_file(port, device_path, local_path):
    """Uses mpremote 'fs cp' to copy a local file to the device."""
    device_path = strip_leading_slash(device_path)
    cmd = [sys.executable, "-m", "mpremote", "connect", port, "fs", "cp", local_path, f":{device_path}"]
    run_cmd(cmd)
    print(json.dumps({"success": True}))

def main():
    parser = argparse.ArgumentParser(description="ElectroAI File System Manager")
    parser.add_argument('--port', required=True)
    parser.add_argument('--action', required=True, choices=['list', 'read', 'delete', 'write', 'rename'])
    parser.add_argument('--path', default="", help="File or folder path on the device (or old path for rename)")
    parser.add_argument('--newpath', default="", help="New file or folder path for rename action")
    parser.add_argument('--localpath', default="", help="Local path for writing file")
    args = parser.parse_args()

    if args.action == 'list':
        list_files(args.port, args.path)
    elif args.action == 'read':
        read_file(args.port, args.path)
    elif args.action == 'delete':
        delete_file(args.port, args.path)
    elif args.action == 'write':
        write_file(args.port, args.path, args.localpath)
    elif args.action == 'rename':
        rename_file(args.port, args.path, args.newpath)

if __name__ == "__main__":
    main()