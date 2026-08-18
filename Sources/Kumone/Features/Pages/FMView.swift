import SwiftUI

/// 私人漫游 — immersive personal FM page.
struct FMView: View {
    @Environment(PlayerService.self) private var player
    @Environment(AccountStore.self) private var account
    @Environment(\.openLogin) private var openLogin
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ZStack {
            backdrop
            if account.hasAuthCookie {
                content
            } else {
                loginPrompt
            }
        }
        .navigationTitle("漫游")
        .toolbarBackground(.hidden, for: .automatic)
    }

    private var track: Track? {
        player.isFMMode ? player.currentTrack : nil
    }

    // MARK: - Backdrop

    private var backdrop: some View {
        ZStack {
            Color.windowBackground
            if let cover = track?.album.picUrl?.resizedImageURL(384) {
                CachedAsyncImage(url: cover)
                    .scaledToFill()
                    .blur(radius: 80)
                    .opacity(colorScheme == .dark ? 0.45 : 0.28)
                    .saturation(1.4)
            }
            LinearGradient(
                colors: [.clear, Color.windowBackground.opacity(0.65)],
                startPoint: .top, endPoint: .bottom
            )
        }
        .ignoresSafeArea()
        .animation(AppAnimation.smooth, value: track?.id)
    }

    // MARK: - Content

    private var content: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 12)

            ZStack {
                if let cover = track?.album.picUrl?.resizedImageURL(768) {
                    CachedAsyncImage(url: cover)
                        .aspectRatio(contentMode: .fill)
                        .frame(maxWidth: 280, maxHeight: 280)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .shadow(color: .black.opacity(0.32), radius: 24, y: 12)
                } else {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(.quaternary.opacity(0.4))
                        .frame(width: 260, height: 260)
                        .overlay(
                            Image(systemName: "wave.3.right.circle")
                                .font(.system(size: 56, weight: .light))
                                .foregroundStyle(.tertiary)
                        )
                }
            }
            .scaleEffect(player.isPlaying && player.isFMMode ? 1 : 0.94)
            .animation(AppAnimation.bouncy, value: player.isPlaying && player.isFMMode)

            VStack(spacing: 5) {
                HStack(spacing: 6) {
                    Text(track?.name ?? String(localized: "私人漫游"))
                        .font(.system(size: 20, weight: .bold))
                        .lineLimit(1)
                    if track?.fee == 1 {
                        VIPBadge()
                    }
                }
                Text(track?.artistNames ?? String(localized: "根据你的口味漫游好音乐"))
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 24)

            if player.isFMMode {
                controls
                    .padding(.top, 8)
            } else {
                Button {
                    player.startFM()
                } label: {
                    Label("开始漫游", systemImage: "wave.3.right")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 12)
                        .background(Theme.accentGradient, in: Capsule())
                        .shadow(color: Theme.accent.opacity(0.35), radius: 10, y: 3)
                }
                .buttonStyle(.pressable)
                .padding(.top, 12)
            }

            Spacer(minLength: 24)
        }
        .padding(.horizontal, 20)
    }

    private var controls: some View {
        HStack(spacing: 24) {
            Button {
                player.fmTrash()
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(width: 48, height: 48)
                    .background(.primary.opacity(0.06), in: Circle())
            }
            .buttonStyle(.pressable)

            Button {
                player.togglePlayPause()
            } label: {
                ZStack {
                    Circle()
                        .fill(Theme.accentGradient)
                        .frame(width: 64, height: 64)
                        .shadow(color: Theme.accent.opacity(0.4), radius: 12, y: 4)
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.white)
                        .contentTransition(.symbolEffect(.replace))
                }
            }
            .buttonStyle(.pressable)

            Button {
                player.fmNext()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(width: 48, height: 48)
                    .background(.primary.opacity(0.06), in: Circle())
            }
            .buttonStyle(.pressable)

            if let track {
                LikeButton(trackID: track.id, size: 18)
                    .frame(width: 48, height: 48)
                    .background(.primary.opacity(0.06), in: Circle())
            }
        }
    }

    private var loginPrompt: some View {
        VStack(spacing: 16) {
            Image(systemName: "wave.3.right.circle")
                .font(.system(size: 52, weight: .light))
                .foregroundStyle(.tertiary)
            Text("登录后开启私人漫游")
                .font(.headline)
            Text("网易云会根据你的听歌口味推荐音乐")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("登录") { openLogin() }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
        }
    }
}
