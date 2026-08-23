import WebKit

/* Push notifications are stripped from this wrapper — the studio doesn't
   use them, and dropping FirebaseMessaging removes the whole Firebase
   dependency. These stubs keep the message-handler surface ViewController
   expects; the web app never posts to the push-* bridges, so they are
   effectively dead code kept for template compatibility. */

func handleSubscribeTouch(message: WKScriptMessage) {
    // no push support in this build
}

func handlePushPermission() {
    // no push support in this build
}

func handlePushState() {
    // no push support in this build
}

func handleFCMToken() {
    // no push support in this build
}

func sendPushToWebView(userInfo: [AnyHashable: Any]) {
    // no push support in this build
}

func sendPushClickToWebView(userInfo: [AnyHashable: Any]) {
    // no push support in this build
}
