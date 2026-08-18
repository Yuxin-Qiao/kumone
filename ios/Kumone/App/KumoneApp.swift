import SwiftUI

@main
struct KumoneApp: App {
    init() {
        // Initialize background audio session on launch
        AudioPlayerManager.shared.setupAudioSession()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
