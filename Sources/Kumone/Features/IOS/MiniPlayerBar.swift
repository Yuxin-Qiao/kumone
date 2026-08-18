import SwiftUI

/// Floating mini player bar docked above the iOS TabBar.
struct MiniPlayerBar: View {
    @Environment(PlayerService.self) private var player
    @Environment(AccountStore.self) private var account

    var body: some View {
        if let track = player.currentTrack {
            Button {
                withAnimation(AppAnimation.smooth) {
                    player.showNowPlaying = true
                }
            } label: {
                HStack(spacing: 10) {
                    CachedAsyncImage(url: track.album.picUrl?.resizedImageURL(128))
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .shadow(color: .black.opacity(0.18), radius: 4, y: 2)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 5) {
                            MarqueeText(text: track.name, font: .system(size: 13, weight: .semibold))
                                .frame(height: 18)
                            if track.fee == 1 {
                                VIPBadge()
                            }
                        }
                        Text(track.artistNames)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(spacing: 12) {
                        LikeButton(trackID: track.id, size: 16)

                        Button {
                            player.togglePlayPause()
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(Theme.accentGradient)
                                    .frame(width: 34, height: 34)
                                    .shadow(color: Theme.accent.opacity(0.35), radius: 4, y: 1)
                                if player.isBuffering && player.isPlaying {
                                    ProgressView()
                                        .controlSize(.small)
                                        .tint(.white)
                                        .scaleEffect(0.7)
                                } else {
                                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(.white)
                                        .contentTransition(.symbolEffect(.replace))
                                }
                            }
                        }
                        .buttonStyle(.pressable)

                        Button {
                            player.next()
                        } label: {
                            Image(systemName: "forward.fill")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.primary)
                                .frame(width: 30, height: 30)
                        }
                        .buttonStyle(.pressable)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .shadow(color: .black.opacity(0.12), radius: 10, y: 3)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12)
            .padding(.bottom, 6)
        }
    }
}
