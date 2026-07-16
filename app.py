#!/usr/bin/env python3
"""
H5 活动页面静态文件服务器
提供 Vue SPA 静态文件服务
"""
from flask import Flask, send_from_directory, request, Response, redirect
import os
import subprocess
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

app = Flask(__name__)

# 获取当前目录作为静态文件根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

BACKEND_BASE_URL = os.environ.get("BACKEND_BASE_URL", "https://martechmng-fe.vercel.app/applications").rstrip("/")

# 手机/局域网访问地址（仅用于启动提示与校验；服务实际监听 0.0.0.0:8848，任意本机网卡 IP 均可）
MOBILE_ACCESS_URL = os.environ.get("MOBILE_ACCESS_URL", "http://10.0.32.23:8848").strip()


def _macos_interface_ipv4s():
    addrs = []
    if sys.platform != "darwin":
        return addrs
    for i in range(12):
        try:
            out = subprocess.check_output(
                ["ipconfig", "getifaddr", f"en{i}"], text=True, timeout=0.35, stderr=subprocess.DEVNULL
            )
            ip = (out or "").strip()
            if ip:
                addrs.append((f"en{i}", ip))
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired, OSError):
            pass
    return addrs


def _lan_url_warning(mobile_url: str):
    """若提示里的主机名不在本机网卡上，打印一条告警（便于同网段手机访问排障）。"""
    try:
        host = urlparse(mobile_url).hostname
    except Exception:
        return
    if not host or host in ("localhost", "127.0.0.1"):
        return
    if sys.platform != "darwin":
        return
    for _, ip in _macos_interface_ipv4s():
        if ip == host:
            return
    en_list = _macos_interface_ipv4s()
    detail = f" 当前本机: {', '.join(f'{a}={b}' for a, b in en_list) or '无 en* 地址'}"
    print(f"⚠ 提示地址中的 {host} 未出现在本机 en* 上。{detail}")
    print("  请在本机将 Wi-Fi 配成该 IP，或设 MOBILE_ACCESS_URL=实际网卡上的 http://<IP>:8848")

@app.route("/api/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
def proxy_api(path):
    """
    反向代理：让前端从同源（web 的 8848）调用后端 API，避免浏览器 CORS 拦截。
    """
    if request.method == "OPTIONS":
        # 预检请求兜底（同源场景通常不会触发，但保持健壮）
        resp = Response(status=204)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Authorization,Content-Type"
        return resp

    target_url = f"{BACKEND_BASE_URL}/api/{path}"
    qs = request.query_string.decode("utf-8") if request.query_string else ""
    if qs:
        target_url = f"{target_url}?{qs}"

    # 过滤掉可能导致代理失败的跳转头
    hop_by_hop = {"host", "connection", "content-length", "transfer-encoding"}
    headers = {}
    for k, v in request.headers.items():
        if k.lower() in hop_by_hop:
            continue
        headers[k] = v

    body = request.get_data() or None
    req = urllib.request.Request(
        target_url,
        data=body,
        headers=headers,
        method=request.method,
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as upstream_resp:
            resp_body = upstream_resp.read()
            # 直接透传状态码与内容类型
            content_type = upstream_resp.headers.get("Content-Type", "application/octet-stream")
            resp = Response(resp_body, status=upstream_resp.status, content_type=content_type)
    except urllib.error.HTTPError as e:
        resp_body = e.read() if hasattr(e, "read") else b""
        content_type = e.headers.get("Content-Type", "application/octet-stream") if e.headers else "application/octet-stream"
        resp = Response(resp_body, status=e.code, content_type=content_type)
    except Exception:
        resp = Response(b"Proxy error", status=502, content_type="text/plain")

    # 即使同源场景通常不需要 CORS，这里仍补上，避免不同访问方式导致的问题
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization,Content-Type"
    return resp

def _redirect_vue_spa():
    """根路径进入 Vue SPA（index.html），由 Vue Router 处理页面路由。"""
    qs = request.query_string.decode("utf-8") if request.query_string else ""
    target = f"/index.html?{qs}" if qs else "/index.html"
    return redirect(target, code=302)


def _redirect_activity_center():
    return _redirect_vue_spa()


@app.route("/")
def root():
    return _redirect_activity_center()


@app.route("/index.html")
def index_html():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/activity.html")
def activity_entry():
    """兼容旧入口：同样直达活动中心（单次跳转）。"""
    return _redirect_activity_center()


@app.route("/gold-coins-exchange.html")
@app.route("/topup-status.html")
def legacy_html_redirect():
    """兼容旧静态 HTML 入口，统一跳转到 Vue SPA。"""
    return _redirect_activity_center()

@app.route('/activity/<path:filename>')
def serve_activity_static(filename):
    """活动页面别名路由：/activity/<file> -> /<file>"""
    if '..' in filename or filename.startswith('/'):
        return "Forbidden", 403
    file_path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return "File not found", 404
    return send_from_directory(BASE_DIR, filename)

@app.route('/<path:filename>')
def serve_static(filename):
    """提供静态文件服务"""
    # 安全处理：只允许访问当前目录下的文件
    if '..' in filename or filename.startswith('/'):
        return "Forbidden", 403
    
    # 检查文件是否存在
    file_path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return "File not found", 404
    
    # 发送文件
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    print("=" * 60)
    print("H5 活动页面服务器启动中...")
    print("=" * 60)
    print(f"本机：http://127.0.0.1:8848")
    print(f"手机/局域网：{MOBILE_ACCESS_URL}（同 WiFi 下打开；监听 0.0.0.0:8848 已放通网内访问）")
    _lan_url_warning(MOBILE_ACCESS_URL)
    print("默认入口：/ -> /index.html（Vue SPA）")
    print("=" * 60)
    # 0.0.0.0：手机用 http://<电脑局域网IP>:8848 即达，不绑定单一 IP
    app.run(host="0.0.0.0", port=8848, debug=True)
