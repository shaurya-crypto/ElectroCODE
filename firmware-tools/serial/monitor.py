import serial
import argparse
import sys
import time

def main():
    parser = argparse.ArgumentParser(description="ElectroAI Serial Monitor")
    parser.add_argument('--port', required=True, help="Serial port (e.g., COM3)")
    parser.add_argument('--baud', type=int, default=115200, help="Baud rate (default: 115200)")
    args = parser.parse_args()

    try:
        # 1. Connect to the chip with retries (Windows sometimes takes a second to release the COM port)
        ser = None
        for attempt in range(10):
            try:
                ser = serial.Serial(args.port, args.baud, timeout=0.5)
                break
            except serial.SerialException:
                if attempt == 9:
                    raise
                time.sleep(0.5)
        
        # Connected without printing boilerplate for a cleaner terminal experience
        # We are now a completely PASSIVE monitor. We do not automatically send Ctrl+C or Ctrl+D, 
        # so we won't interrupt code that is already running from the Uploader.
        


        # 6. The Streaming Loop
        buffer = ""
        while True:
            if ser.in_waiting > 0:
                try:
                    raw_data = ser.read(ser.in_waiting)
                    buffer += raw_data.decode('utf-8', errors='replace')
                    
                    # Print full lines as they come in
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        print(line.rstrip('\r'))
                        sys.stdout.flush()
                    
                    # Print the REPL prompt instantly without waiting for an Enter key
                    if ">>> " in buffer:
                        print(">>> ")
                        sys.stdout.flush()
                        buffer = buffer.replace(">>> ", "")
                        
                except Exception:
                    pass 
            
            time.sleep(0.01) 

    except serial.SerialException:
        print(f"Error: Could not open port {args.port}. Is Thonny still open?")
        sys.stdout.flush()
        sys.exit(1)
    except KeyboardInterrupt:
        if 'ser' in locals() and ser.is_open:
            ser.close()
        sys.exit(0)

if __name__ == "__main__":
    main()