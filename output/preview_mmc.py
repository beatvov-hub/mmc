from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        translated = super().translate_path(path)
        if not Path(translated).exists() and Path(translated + '.html').is_file():
            return translated + '.html'
        return translated

ThreadingHTTPServer(('127.0.0.1', 8766), PreviewHandler).serve_forever()
