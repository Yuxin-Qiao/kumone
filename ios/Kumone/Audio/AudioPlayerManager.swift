import Foundation
import AVFoundation
import MediaPlayer
import UIKit

/// Native Audio Player Manager for Kumone on iOS.
/// Handles background audio playback, lock screen controls, audio session interruptions and route changes.
final class AudioPlayerManager: NSObject {
    static let shared = AudioPlayerManager()

    private var player: AVPlayer?
    private var timeObserverToken: Any?
    private var currentTrack: [String: Any]?
    private var isSeeking = false

    // Callback closure to notify WebView of playback updates
    var onPlaybackProgress: ((_ isPlaying: Bool, _ posMs: Int, _ durMs: Int) -> Void)?
    var onPlaybackEnded: (() -> Void)?
    var onRemoteNext: (() -> Void)?
    var onRemotePrev: (() -> Void)?

    private override init() {
        super.init()
        setupAudioSession()
        setupRemoteCommands()
        setupNotifications()
    }

    deinit {
        removeTimeObserver()
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Audio Session Setup

    func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.allowAirPlay, .allowBluetoothA2DP])
            try session.setActive(true)
        } catch {
            print("[AudioPlayerManager] Failed to set AVAudioSession category: \(error.localizedDescription)")
        }
    }

    // MARK: - Notifications & Interruption Handling

    private func setupNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(notification:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange(notification:)),
            name: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance()
        )
    }

    @objc private func handleInterruption(notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        switch type {
        case .began:
            pause()
        case .ended:
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) {
                    resume()
                }
            }
        @unknown default:
            break
        }
    }

    @objc private func handleRouteChange(notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }

        // Auto-pause when headphones / AirPods are unplugged or disconnected
        if reason == .oldDeviceUnavailable {
            pause()
        }
    }

    // MARK: - Remote Command Center (Lock Screen / Control Center)

    private func setupRemoteCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.isEnabled = true
        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.resume()
            return .success
        }

        commandCenter.pauseCommand.isEnabled = true
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.pause()
            return .success
        }

        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            if self.isPlaying {
                self.pause()
            } else {
                self.resume()
            }
            return .success
        }

        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.onRemoteNext?()
            return .success
        }

        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.onRemotePrev?()
            return .success
        }

        commandCenter.changePlaybackPositionCommand.isEnabled = true
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self = self,
                  let positionEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self.seek(to: Int(positionEvent.positionTime * 1000))
            return .success
        }
    }

    // MARK: - Playback Controls

    var isPlaying: Bool {
        guard let player = player else { return false }
        return player.timeControlStatus == .playing || player.rate > 0
    }

    func play(url: String, track: [String: Any], startPosMs: Int = 0) {
        guard let audioURL = URL(string: url) else {
            print("[AudioPlayerManager] ❌ Invalid audio URL: \(url)")
            return
        }

        self.currentTrack = track
        setupAudioSession()

        removeTimeObserver()
        if let currentItem = player?.currentItem {
            NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: currentItem)
            NotificationCenter.default.removeObserver(self, name: .AVPlayerItemFailedToPlayToEndTime, object: currentItem)
        }

        let playerItem = AVPlayerItem(url: audioURL)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerItemDidReachEnd),
            name: .AVPlayerItemDidPlayToEndTime,
            object: playerItem
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerItemDidFail),
            name: .AVPlayerItemFailedToPlayToEndTime,
            object: playerItem
        )

        if player == nil {
            player = AVPlayer(playerItem: playerItem)
        } else {
            player?.replaceCurrentItem(with: playerItem)
        }

        if startPosMs > 0 {
            let targetTime = CMTime(value: Int64(startPosMs), timescale: 1000)
            player?.seek(to: targetTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
                self?.player?.play()
                self?.updateNowPlayingInfo()
            }
        } else {
            player?.play()
            updateNowPlayingInfo()
        }

        setupTimeObserver()
    }

    func pause() {
        player?.pause()
        updateNowPlayingInfo()
        notifyProgress()
    }

    func resume() {
        setupAudioSession()
        player?.play()
        updateNowPlayingInfo()
        notifyProgress()
    }

    func seek(to posMs: Int) {
        guard let player = player else { return }
        isSeeking = true
        let targetTime = CMTime(value: Int64(posMs), timescale: 1000)
        player.seek(to: targetTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            self?.isSeeking = false
            self?.updateNowPlayingInfo()
            self?.notifyProgress()
        }
    }

    @objc private func playerItemDidReachEnd() {
        onPlaybackEnded?()
    }

    @objc private func playerItemDidFail() {
        print("[AudioPlayerManager] Playback failed, advancing to next track")
        onPlaybackEnded?()
    }

    // MARK: - Time Observer

    private func setupTimeObserver() {
        let interval = CMTime(value: 250, timescale: 1000) // 250ms update
        timeObserverToken = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
            guard let self = self, !self.isSeeking else { return }
            self.notifyProgress()
        }
    }

    private func removeTimeObserver() {
        if let token = timeObserverToken {
            player?.removeTimeObserver(token)
            timeObserverToken = nil
        }
    }

    private func notifyProgress() {
        guard let player = player, let currentItem = player.currentItem else { return }
        let isPlaying = self.isPlaying
        let posMs = Int(CMTimeGetSeconds(player.currentTime()) * 1000)
        let durSeconds = CMTimeGetSeconds(currentItem.duration)
        let durMs = durSeconds.isNaN || durSeconds.isInfinite ? 0 : Int(durSeconds * 1000)

        onPlaybackProgress?(isPlaying, posMs, durMs)
    }

    // MARK: - Now Playing Info Center

    private func updateNowPlayingInfo() {
        guard let track = currentTrack else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }

        var info: [String: Any] = [:]
        info[MPMediaItemPropertyTitle] = track["name"] as? String ?? "Kumone"
        info[MPMediaItemPropertyArtist] = Self.artistName(from: track)
        if let album = track["album"] as? [String: Any], let albumName = album["name"] as? String {
            info[MPMediaItemPropertyAlbumTitle] = albumName
        }

        let durMs = Self.number(track["durationMS"]) ?? ((Self.number(track["duration"]) ?? 0) * 1000)
        info[MPMediaItemPropertyPlaybackDuration] = durMs / 1000.0

        if let player = player {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = CMTimeGetSeconds(player.currentTime())
            info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        }

        if let picUrlStr = Self.artworkURL(from: track), let picURL = URL(string: picUrlStr) {
            URLSession.shared.dataTask(with: picURL) { data, _, _ in
                if let data = data, let image = UIImage(data: data) {
                    DispatchQueue.main.async {
                        var updatedInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? info
                        let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                        updatedInfo[MPMediaItemPropertyArtwork] = artwork
                        MPNowPlayingInfoCenter.default().nowPlayingInfo = updatedInfo
                    }
                }
            }.resume()
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private static func artistName(from track: [String: Any]) -> String {
        if let artist = track["artist"] as? String, !artist.isEmpty {
            return artist
        }
        if let artists = track["artists"] as? [[String: Any]] {
            let names = artists.compactMap { $0["name"] as? String }
            if !names.isEmpty { return names.joined(separator: " / ") }
        }
        return "Kumone"
    }

    private static func artworkURL(from track: [String: Any]) -> String? {
        if let picUrl = track["picUrl"] as? String, !picUrl.isEmpty {
            return picUrl
        }
        if let album = track["album"] as? [String: Any], let picUrl = album["picUrl"] as? String, !picUrl.isEmpty {
            return picUrl
        }
        return nil
    }

    private static func number(_ value: Any?) -> Double? {
        if let doubleVal = value as? Double { return doubleVal }
        if let intVal = value as? Int { return Double(intVal) }
        if let number = value as? NSNumber { return number.doubleValue }
        if let stringVal = value as? String { return Double(stringVal) }
        return nil
    }
}
