import http.server
import os
import sys
import functools


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """静态服务器：禁用缓存，避免手机浏览器加载旧版页面。"""

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8778
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(('0.0.0.0', port), handler) as httpd:
        print('serving %s on 0.0.0.0:%d' % (root, port), flush=True)
        httpd.serve_forever()


if __name__ == '__main__':
    main()
