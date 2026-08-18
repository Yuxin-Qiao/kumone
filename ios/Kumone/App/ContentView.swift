import SwiftUI
import WebKit
import UIKit

struct ContentView: View {
    var body: some View {
        ZStack {
            Color(red: 0.09, green: 0.09, blue: 0.10)
                .ignoresSafeArea()

            KumoneWebViewContainer()
                .ignoresSafeArea()
        }
    }
}

struct KumoneWebViewContainer: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let userContent = WKUserContentController()
        let bridge = KumoneIOSBridge()
        userContent.add(bridge, name: "kumoneBridge")
        userContent.addUserScript(bridge.cookieBootstrapScript)

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.userContentController = userContent
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        let webView = WKWebView(frame: .zero, configuration: config)
        bridge.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = true
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        if #available(iOS 16.4, *) {
            #if DEBUG
            webView.isInspectable = true
            #endif
        }

        context.coordinator.bridge = bridge
        #if DEBUG
        context.coordinator.startCommandPoll(webView: webView)
        #endif
        loadBundledWebApp(into: webView)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "kumoneBridge")
        coordinator.stopCommandPoll()
    }

    private func loadBundledWebApp(into webView: WKWebView) {
        if let indexHTML = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            let webDir = indexHTML.deletingLastPathComponent()
            webView.loadFileURL(indexHTML, allowingReadAccessTo: webDir)
            return
        }
        if let webDir = Bundle.main.url(forResource: "web", withExtension: nil) {
            let indexHTML = webDir.appendingPathComponent("index.html")
            webView.loadFileURL(indexHTML, allowingReadAccessTo: webDir)
            return
        }
        print("[Kumone] Could not find web/index.html in the app bundle")
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        var bridge: KumoneIOSBridge?
        var commandTimer: Timer?

        func stopCommandPoll() {
            commandTimer?.invalidate()
            commandTimer = nil
        }

        func startCommandPoll(webView: WKWebView) {
            commandTimer?.invalidate()
            commandTimer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak webView] _ in
                let file = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                    .appendingPathComponent("kumone-e2e.txt")
                guard let raw = try? String(contentsOf: file, encoding: .utf8) else { return }
                let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return }
                try? FileManager.default.removeItem(at: file)
                let parts = trimmed.split(separator: ":", maxSplits: 1).map(String.init)
                let cmd = parts.first ?? ""
                let arg = parts.count > 1 ? parts[1] : ""
                Self.runE2E(cmd: cmd, arg: arg, webView: webView)
            }
        }

        static func runE2E(cmd: String, arg: String, webView: WKWebView?) {
            guard !cmd.isEmpty,
                  let cmdData = try? JSONSerialization.data(withJSONObject: cmd, options: .fragmentsAllowed),
                  let argData = try? JSONSerialization.data(withJSONObject: arg, options: .fragmentsAllowed),
                  let cmdJSON = String(data: cmdData, encoding: .utf8),
                  let argJSON = String(data: argData, encoding: .utf8) else { return }
            webView?.evaluateJavaScript(
                "window.kumoneApp && typeof window.kumoneApp.e2e === 'function' && window.kumoneApp.e2e(\(cmdJSON), \(argJSON))",
                completionHandler: nil
            )
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            print("[Kumone] Web interface loaded")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            print("[Kumone] Failed to load web interface: \(error.localizedDescription)")
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if url.scheme == "orpheus" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            if navigationAction.navigationType == .linkActivated,
               let scheme = url.scheme,
               ["http", "https"].contains(scheme) {
                let host = url.host ?? ""
                if !host.contains("163.com") && !host.contains("126.net") {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }

            decisionHandler(.allow)
        }
    }
}
