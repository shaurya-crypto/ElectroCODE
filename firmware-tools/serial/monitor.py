import serial
import argparse
import sys
import time
import threading

def stdin_listener(ser):
    """
    Listen to stdin and forward to serial port.
    Crucial for sending Ctrl+C (\x03) to stop running code.
    """
    try:
        while True:
            # On Windows, sys.stdin.read(1) might block.
            # But since it's a daemon thread, it's fine.
            char = sys.stdin.read(1)
            if not char: break
            if ser and ser.is_open:
                try:
                    ser.write(char.encode())
                    ser.flush()
                except:
                    pass
    except EOFError:
        pass
    except Exception:
        pass

def main():
    parser = argparse.ArgumentParser(description="ElectroAI Serial Monitor")
    parser.add_argument('--port', required=True, help="Serial port (e.g., COM3)")
    parser.add_argument('--baud', type=int, default=115200, help="Baud rate (default: 115200)")
    args = parser.parse_args()

    port = args.port

    try:
        # 1. Connect to the chip with retries
        ser = None
        for attempt in range(10):
            try:
                ser = serial.Serial(port, args.baud, timeout=0.5)
                break
            except (serial.SerialException, OSError) as e:
                err_str = str(e)
                if attempt == 9:
                    if "Access is denied" in err_str:
                        print(f"Error: Port {port} is used by another program (e.g. Thonny or Arduino IDE).")
                    elif "FileNotFound" in err_str or "device not found" in err_str:
                        print(f"Error: Device disconnected or port {port} not found.")
                    else:
                        print(f"Error: Could not open port {port}. {err_str}")
                    sys.stdout.flush()
                    sys.exit(1)
                time.sleep(0.5)
        
        if not ser:
            sys.exit(1)

        # 2. Start stdin listener thread to bridge commands from Electron to Device
        t = threading.Thread(target=stdin_listener, args=(ser,), daemon=True)
        t.start()

        # 3. The Streaming Loop
        buffer = ""
        while True:
            if ser.in_waiting > 0:
                try:
                    raw_data = ser.read(ser.in_waiting)
                    decoded = raw_data.decode('utf-8', errors='replace')
                    buffer += decoded
                    
                    # Print full lines as they come in
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        print(line.rstrip('\r'))
                        sys.stdout.flush()
                    
                    # Print the REPL prompt instantly without waiting for an Enter key
                    if ">>> " in buffer:
                        sys.stdout.write(">>> ")
                        sys.stdout.flush()
                        buffer = buffer.replace(">>> ", "")
                        
                except Exception:
                    pass 
            
            time.sleep(0.01) 

    except (serial.SerialException, OSError) as e:
        err_str = str(e)
        if "Access is denied" in err_str:
            print(f"\n[System] Error: Port {port} is used by another program.")
        elif "FileNotFound" in err_str or "device not found" in err_str or "disconnected" in err_str.lower():
            print(f"\n[System] Error: Device disconnected.")
        else:
            print(f"\n[System] Error: Serial communication lost. {err_str}")
        sys.stdout.flush()
        sys.exit(1)
    except KeyboardInterrupt:
        if 'ser' in locals() and ser and ser.is_open:
            ser.close()
        sys.exit(0)

if __name__ == "__main__":
    main()