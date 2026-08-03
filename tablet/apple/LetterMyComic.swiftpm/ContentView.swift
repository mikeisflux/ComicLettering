import SwiftUI
import WebKit

/* The studio, full screen. The whole app is the site — cookies and the
   browser-side project store persist between launches because the web
   view uses the default (persistent) data store. */
struct ContentView: View {
    var body: some View {
        StudioWebView(url: URL(string: "https://lettermycomic.com/app")!)
            .ignoresSafeArea(.container, edges: .bottom)
            .background(Color(red: 0x24 / 255, green: 0x30 / 255, blue: 0x3F / 255))
    }
}

struct StudioWebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()          // persistent projects
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = false // swipes belong to the editor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0x24 / 255, green: 0x30 / 255, blue: 0x3F / 255, alpha: 1)
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        /* keep the app on the studio's own site; anything external
           (PayPal, blog links out, mailto) opens in the system browser */
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let dest = navigationAction.request.url else { return decisionHandler(.allow) }
            let host = dest.host ?? ""
            if host.isEmpty || host == "lettermycomic.com" || host.hasSuffix(".lettermycomic.com") {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(dest)
                decisionHandler(.cancel)
            }
        }

        /* offline or a hiccup: retry into the studio rather than showing
           a white page */
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                webView.load(URLRequest(url: URL(string: "https://lettermycomic.com/app")!))
            }
        }
    }
}
