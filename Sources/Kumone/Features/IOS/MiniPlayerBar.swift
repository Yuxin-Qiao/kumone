import SwiftUI

/// Ultra-refined floating mini player bar for iOS.
struct MiniPlayerBar: View {
    @Environment(PlayerService.self) private var player
    @Environment(AccountStore.self) private var account

    private var fraction: Double {
        guard player.duration > 0 else { return 0 }
        return min(max(player.progress / player.duration, 0), 1)
    }

    var body: some View {
        if let track = player.currentTrack {
            Button {
                withAnimation(AppAnimation.spring) {
                    player.showNowPlaying = true
                }
            } label: {
                VStack(spacing: 0) {
                    // Playback progress hairline
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Color.primary.opacity(0.06))
                            Rectangle()
                                .fill(Theme.accent)
                                .frame(width: geo.size.width * fraction)
                        }
                    }
                    .frame(height: 2)

                    HStack(spacing: 12) {
                        // Album Artwork with smooth shadow
                        CachedAsyncImage(url: track.album.picUrl?.resizedImageURL(128))
                            .frame(width: 44, height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .shadow(color: .black.opacity(0.2), radius: 6, y: 2)

                        // Title & Artist
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(track.name)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                if track.fee == 1 {
                                    VIPBadge()
                                }
                            }

                            Text(track.artistNames)
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        // Controls
                        HStack(spacing: 14) {
                            let liked = account.isLiked(track.id)
                            Button {
                                Task { await account.toggleLike(trackID: track.id) }
                            } label: {
                                Image(systemName: liked ? "heart.fill" : "heart")
                                    .font(.system(size: 18))
                                    .foregroundStyle(liked ? Theme.accent : .secondary)
                                    .frame(width: 32, height: 32)
                            }
                            .buttonStyle(.pressable)

                            Button {
                                player.togglePlayPause()
                            } label: {
                                ZStack {
                                    Circle()
                                        .fill(Theme.accentGradient)
                                        .frame(width: 36, height: 36)
                                        .shadow(color: Theme.accent.opacity(0.35), radius: 6, y: 2)

                                    if player.isBuffering && player.isPlaying {
                                        ProgressView()
                                            .controlSize(.small)
                                            .tint(.white)
                                    } else {
                                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundStyle(.white)
                                    }
                                }
                            }
                            .buttonStyle(.pressable)

                            Button {
                                player.next()
                            } label: {
                                Image(systemName: "forward.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(.primary)
                                    .frame(width: 32, height: 32)
                            }
                            .buttonStyle(.pressable)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.15), lineWidth: 0.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 14)
        }
    }
}
