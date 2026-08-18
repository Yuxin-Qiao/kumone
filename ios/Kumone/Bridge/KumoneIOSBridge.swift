import Foundation
import WebKit
import UIKit

/// Bridge connecting WKWebView JS client with iOS native subsystems (URLSession network proxy, AVPlayer, Haptics).
final class KumoneIOSBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private let urlSession: URLSession
    private let defaults = UserDefaults.standard

    var cookieBootstrapScript: WKUserScript {
        let raw = defaults.string(forKey: "kumone_cookies") ?? "{}"
        let payload = Self.jsonEncode(raw) ?? "\"{}\""
        let source = """
        try { localStorage.setItem('kumone_cookies', \(payload)); } catch (e) {}
        window.__KUMONE_IOS__ = true;
        (function () {
          function send(msg) {
            try {
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.kumoneBridge) {
                window.webkit.messageHandlers.kumoneBridge.postMessage({ action: 'log', message: String(msg) });
              }
            } catch (e) {}
          }
          window.addEventListener('error', function (e) { send('error: ' + (e.message || e)); });
          window.addEventListener('unhandledrejection', function (e) { send('unhandled: ' + (e.reason && (e.reason.message || e.reason))); });
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    override init() {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.httpCookieStorage = nil
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 20
        self.urlSession = URLSession(configuration: config)
        super.init()

        setupAudioCallbacks()
    }

    private func setupAudioCallbacks() {
        AudioPlayerManager.shared.onPlaybackProgress = { [weak self] isPlaying, posMs, durMs in
            self?.dispatchJS("onNativePlaybackProgress", args: "\(isPlaying), \(posMs), \(durMs)")
        }

        AudioPlayerManager.shared.onPlaybackEnded = { [weak self] in
            self?.dispatchJS("onNativePlaybackComplete")
        }

        AudioPlayerManager.shared.onRemoteNext = { [weak self] in
            self?.dispatchJS("onNativeNext")
            self?.dispatchJS("onNativeRemoteNext")
        }

        AudioPlayerManager.shared.onRemotePrev = { [weak self] in
            self?.dispatchJS("onNativePrev")
            self?.dispatchJS("onNativeRemotePrev")
        }
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "kumoneBridge",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }

        switch action {
        case "asyncHttpRequest":
            handleAsyncHttpRequest(body)
        case "playAudio":
            handlePlayAudio(body)
        case "pauseAudio":
            AudioPlayerManager.shared.pause()
        case "resumeAudio":
            AudioPlayerManager.shared.resume()
        case "seekAudio":
            if let pos = Self.intValue(body["position"]) {
                AudioPlayerManager.shared.seek(to: pos)
            }
        case "toast":
            if let msg = body["message"] as? String {
                triggerHaptic(style: "light")
                print("[Kumone] toast: \(msg)")
            }
        case "haptic":
            triggerHaptic(style: body["style"] as? String)
        case "copyToClipboard":
            if let text = body["text"] as? String {
                UIPasteboard.general.string = text
            }
        case "openExternal":
            if let urlStr = body["url"] as? String, let url = URL(string: urlStr) {
                DispatchQueue.main.async {
                    UIApplication.shared.open(url)
                }
            }
        case "openNeteaseApp":
            handleOpenNeteaseApp(body)
        case "setPreference":
            if let key = body["key"] as? String, let value = body["value"] as? String {
                defaults.set(value, forKey: key)
            }
        case "log":
            if let msg = body["message"] as? String {
                print("[KumoneJS] \(msg)")
            }
        default:
            print("[KumoneIOSBridge] Unhandled action: \(action)")
        }
    }

    // MARK: - Native HTTP Proxy (CORS-Bypass)

    private func handleAsyncHttpRequest(_ params: [String: Any]) {
        guard let reqId = params["reqId"] as? String,
              let urlStr = params["url"] as? String,
              let targetURL = URL(string: urlStr) else {
            return
        }

        let method = (params["method"] as? String ?? "GET").uppercased()
        var request = URLRequest(url: targetURL)
        request.httpMethod = method
        request.timeoutInterval = 15.0

        var hasUserAgent = false
        var hasReferer = false
        if let headers = params["headers"] as? [String: Any] {
            for (key, val) in headers {
                guard let strVal = val as? String, !strVal.isEmpty else { continue }
                request.setValue(strVal, forHTTPHeaderField: key)
                if key.caseInsensitiveCompare("User-Agent") == .orderedSame { hasUserAgent = true }
                if key.caseInsensitiveCompare("Referer") == .orderedSame { hasReferer = true }
            }
        }
        if !hasUserAgent {
            request.setValue(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                forHTTPHeaderField: "User-Agent"
            )
        }
        if !hasReferer && urlStr.contains("163.com") {
            request.setValue("https://music.163.com", forHTTPHeaderField: "Referer")
        }

        if method != "GET" && method != "HEAD", let bodyStr = params["body"] as? String, !bodyStr.isEmpty {
            request.httpBody = bodyStr.data(using: .utf8)
        }

        urlSession.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                self?.invokeHttpCallback(reqId: reqId, error: error.localizedDescription, response: nil)
                return
            }

            guard let httpResp = response as? HTTPURLResponse else {
                self?.invokeHttpCallback(reqId: reqId, error: "Invalid HTTP response", response: nil)
                return
            }

            let status = httpResp.statusCode
            let ok = (200..<300).contains(status)
            let bodyText = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            let cookies = Self.extractSetCookies(from: httpResp)

            var headersDict: [String: String] = [:]
            for (key, value) in httpResp.allHeaderFields {
                headersDict[String(describing: key)] = String(describing: value)
            }

            let respObj: [String: Any] = [
                "status": status,
                "statusText": HTTPURLResponse.localizedString(forStatusCode: status),
                "ok": ok,
                "data": bodyText,
                "body": bodyText,
                "headers": headersDict,
                "cookies": cookies
            ]
            self?.invokeHttpCallback(reqId: reqId, error: nil, response: respObj)
        }.resume()
    }

    private func invokeHttpCallback(reqId: String, error: String?, response: [String: Any]?) {
        let reqJSON = Self.jsonEncode(reqId) ?? "\"\""
        let errJSON = error.flatMap { Self.jsonEncode($0) } ?? "null"
        let respJSON: String
        if let response = response,
           let data = try? JSONSerialization.data(withJSONObject: response),
           let text = String(data: data, encoding: .utf8) {
            respJSON = text
        } else {
            respJSON = "null"
        }
        evaluateJS("if (window.__nativeHttpCallback) { window.__nativeHttpCallback(\(reqJSON), \(errJSON), \(respJSON)); }")
    }

    // MARK: - Audio Playback Handler

    private func handlePlayAudio(_ params: [String: Any]) {
        guard let url = params["url"] as? String else { return }
        let track = params["track"] as? [String: Any] ?? [:]
        let position = Self.intValue(params["position"]) ?? 0
        AudioPlayerManager.shared.play(url: url, track: track, startPosMs: position)
    }

    // MARK: - App URL Scheme Jump

    private func handleOpenNeteaseApp(_ params: [String: Any]) {
        guard let unikey = params["unikey"] as? String, !unikey.isEmpty else { return }
        let candidates = [
            "orpheus://login?codekey=\(unikey)",
            "orpheus://login?unikey=\(unikey)",
            "https://music.163.com/login?codekey=\(unikey)"
        ]
        DispatchQueue.main.async {
            for candidate in candidates {
                if let url = URL(string: candidate) {
                    UIApplication.shared.open(url)
                    return
                }
            }
        }
    }

    // MARK: - Haptics & JS

    private func triggerHaptic(style: String?) {
        DispatchQueue.main.async {
            switch style {
            case "heavy":
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            case "medium":
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "success":
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "error":
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            default:
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        }
    }

    private func dispatchJS(_ function: String, args: String = "") {
        let script = """
        (function(){
          var app = window.kumoneApp || {};
          var fn = app.\(function) || window.\(function);
          if (typeof fn === 'function') { fn(\(args)); }
        })();
        """
        evaluateJS(script)
    }

    private func evaluateJS(_ script: String) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    private static func intValue(_ value: Any?) -> Int? {
        if let intVal = value as? Int { return intVal }
        if let doubleVal = value as? Double { return Int(doubleVal) }
        if let number = value as? NSNumber { return number.intValue }
        if let stringVal = value as? String { return Int(stringVal) }
        return nil
    }

    private static func jsonEncode(_ value: String) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: .fragmentsAllowed) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private static func extractSetCookies(from response: HTTPURLResponse) -> [String] {
        var headerFields: [String: String] = [:]
        for (key, value) in response.allHeaderFields {
            headerFields[String(describing: key)] = String(describing: value)
        }
        let url = response.url ?? URL(string: "https://music.163.com")!
        var cookies: [String] = HTTPCookie.cookies(withResponseHeaderFields: headerFields, for: url).map {
            "\($0.name)=\($0.value)"
        }
        if cookies.isEmpty, let raw = response.value(forHTTPHeaderField: "Set-Cookie"), !raw.isEmpty {
            cookies.append(raw)
        }
        return cookies
    }
}
