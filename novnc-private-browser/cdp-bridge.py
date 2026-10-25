#!/usr/bin/env python3
"""
CDP Bridge: Chromium ke loopback debugging port (127.0.0.1:9222) ko
0.0.0.0:9223 par forward karta hai, taaki host se Python connect kar sake.
"""
import socket
import threading

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 9223
TARGET_HOST = "127.0.0.1"
TARGET_PORT = 9222

def handle(client_socket):
    target_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        target_socket.connect((TARGET_HOST, TARGET_PORT))
    except ConnectionRefusedError:
        client_socket.close()
        return

    def forward(source, destination):
        try:
            while True:
                data = source.recv(4096)
                if not data:
                    break
                destination.sendall(data)
        except Exception:
            pass
        finally:
            source.close()
            destination.close()

    threading.Thread(target=forward, args=(client_socket, target_socket), daemon=True).start()
    threading.Thread(target=forward, args=(target_socket, client_socket), daemon=True).start()

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((LISTEN_HOST, LISTEN_PORT))
    server.listen(5)
    print(f"CDP bridge listening on {LISTEN_HOST}:{LISTEN_PORT} -> {TARGET_HOST}:{TARGET_PORT}")
    while True:
        client, addr = server.accept()
        threading.Thread(target=handle, args=(client,), daemon=True).start()

if __name__ == "__main__":
    main()
