// Skal iOS — Phase 0 host app.
//
// This is the minimal SwiftUI shell that consumes Skal.framework
// produced by ../build.gradle.kts. The framework's
// `MainKt.MainViewController()` returns a UIViewController hosting
// Compose Multiplatform UI; we wrap it in UIViewControllerRepresentable
// so SwiftUI can put it on screen.
//
// When the JS runtime arrives (see docs/ios-port.md), the placeholder
// content inside MainViewController gets replaced by SkalRoot(bridge)
// — this Swift host stays unchanged.

import SwiftUI
import Skal

struct ComposeContainer: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        // `MainKt` is the Kotlin-generated Obj-C class for the
        // top-level functions in src/iosMain/kotlin/com/skal/ios/Main.kt.
        // The factory returns a fresh ComposeUIViewController on each
        // call; SwiftUI calls makeUIViewController exactly once for the
        // lifetime of this view, so no retain bookkeeping needed.
        return MainKt.MainViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController,
                                context: Context) {
        // Compose drives its own state — nothing for SwiftUI to push down.
    }
}

@main
struct SkalIosApp: App {
    var body: some Scene {
        WindowGroup {
            // No `.ignoresSafeArea()` — letting SwiftUI keep the
            // status-bar inset means our Compose Column starts below
            // the notch/clock instead of underneath them. The Compose
            // side already adds its own padding(24.dp), so it pads
            // away from the SwiftUI safe-area inset cleanly.
            ComposeContainer()
        }
    }
}
