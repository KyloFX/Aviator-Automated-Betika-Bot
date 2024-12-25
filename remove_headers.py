from mitmproxy import http

def request(flow: http.HTTPFlow) -> None:
    # Remove headers that expose proxy usage
    headers_to_remove = ["Via", "X-Forwarded-For", "Forwarded", "X-Real-IP"]
    for header in headers_to_remove:
        if header in flow.request.headers:
            del flow.request.headers[header]
