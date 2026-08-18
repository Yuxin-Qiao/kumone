import SwiftUI

/// Mobile user profile & music library page for iOS.
struct IOSLibraryView: View {
    @Environment(AccountStore.self) private var account
    @Environment(PlayerService.self) private var player
    @Environment(\.openLogin) private var openLogin

    @State private var showNewPlaylist = false
    @State private var newPlaylistName = ""
    @State private var showSettings = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                profileHeader
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                if account.isLoggedIn {
                    quickAccessSection
                        .padding(.horizontal, 16)

                    createdPlaylistsSection
                    subscribedPlaylistsSection
                } else {
                    unloggedPrompt
                        .padding(.horizontal, 16)
                        .padding(.top, 24)
                }

                Color.clear.frame(height: 20)
            }
        }
        .navigationTitle("我的")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                SettingsView()
                    .navigationTitle("设置")
                    #if os(iOS)
                    .navigationBarTitleDisplayMode(.inline)
                    #endif
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("完成") {
                                showSettings = false
                            }
                        }
                    }
            }
        }
        .alert("新建歌单", isPresented: $showNewPlaylist) {
            TextField("歌单名称", text: $newPlaylistName)
            Button("创建") {
                let name = newPlaylistName.trimmingCharacters(in: .whitespaces)
                newPlaylistName = ""
                guard !name.isEmpty else { return }
                Task {
                    do {
                        try await NeteaseAPI.createPlaylist(name: name, isPrivate: false)
                        await account.refreshLibrary()
                        ToastCenter.shared.show(String(localized: "歌单已创建"))
                    } catch {
                        ToastCenter.shared.show(error.localizedDescription)
                    }
                }
            }
            Button("取消", role: .cancel) { newPlaylistName = "" }
        }
        .refreshable {
            if account.isLoggedIn {
                await account.refreshLibrary()
            }
        }
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        HStack(spacing: 14) {
            if let profile = account.profile {
                CachedAsyncImage(url: profile.avatarUrl?.resizedImageURL(128))
                    .frame(width: 54, height: 54)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(Theme.accent.opacity(0.4), lineWidth: 1.5))
                    .shadow(color: .black.opacity(0.12), radius: 6, y: 2)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(profile.nickname)
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                        if profile.vipType > 0 {
                            VIPBadge()
                        }
                    }
                    if let signature = profile.signature, !signature.isEmpty {
                        Text(signature)
                            .font(.system(size: 11.5))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
            } else {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 52))
                    .foregroundStyle(.tertiary)

                VStack(alignment: .leading, spacing: 3) {
                    Text("未登录网易云音乐")
                        .font(.system(size: 16, weight: .semibold))
                    Text("登录后同步歌单、收藏与云盘")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button("登录") {
                    openLogin()
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .controlSize(.small)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.primary.opacity(0.04))
        )
    }

    // MARK: - Quick Access

    private var quickAccessSection: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            if let liked = account.likedSongsPlaylist {
                NavigationLink(value: Destination.playlist(liked.id)) {
                    quickAccessCard(
                        title: "我喜欢的音乐",
                        subtitle: "\(account.likedTrackIDs.count) 首",
                        icon: "heart.fill",
                        gradient: [Theme.accentDeep, Theme.accent]
                    )
                }
                .buttonStyle(.plain)
            }

            NavigationLink(value: Destination.daily) {
                quickAccessCard(
                    title: "每日推荐",
                    subtitle: "专属口味生成",
                    icon: "calendar",
                    gradient: [Color(red: 0.85, green: 0.45, blue: 0.2),
                               Color(red: 0.95, green: 0.65, blue: 0.25)]
                )
            }
            .buttonStyle(.plain)

            NavigationLink(destination: RecentsView()) {
                quickAccessCard(
                    title: "最近播放",
                    subtitle: "播放记录",
                    icon: "clock.fill",
                    gradient: [Color(red: 0.2, green: 0.5, blue: 0.8),
                               Color(red: 0.35, green: 0.7, blue: 0.9)]
                )
            }
            .buttonStyle(.plain)

            NavigationLink(destination: CollectionsView()) {
                quickAccessCard(
                    title: "我的收藏",
                    subtitle: "专辑与歌手",
                    icon: "star.fill",
                    gradient: [Color(red: 0.55, green: 0.25, blue: 0.75),
                               Color(red: 0.75, green: 0.45, blue: 0.9)]
                )
            }
            .buttonStyle(.plain)

            NavigationLink(destination: CloudView()) {
                quickAccessCard(
                    title: "音乐云盘",
                    subtitle: "云端存储",
                    icon: "icloud.fill",
                    gradient: [Color(red: 0.15, green: 0.65, blue: 0.6),
                               Color(red: 0.25, green: 0.8, blue: 0.75)]
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func quickAccessCard(title: LocalizedStringKey, subtitle: String,
                                icon: String, gradient: [Color]) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 38, height: 38)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.primary.opacity(0.04))
        )
    }

    // MARK: - Created Playlists

    @ViewBuilder
    private var createdPlaylistsSection: some View {
        if !account.createdPlaylists.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("创建的歌单 (\(account.createdPlaylists.count))")
                        .font(.system(size: 16, weight: .bold))
                    Spacer()
                    Button {
                        showNewPlaylist = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(Theme.accent)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)

                LazyVStack(spacing: 4) {
                    ForEach(account.createdPlaylists) { playlist in
                        playlistRow(playlist)
                    }
                }
                .padding(.horizontal, 12)
            }
        }
    }

    // MARK: - Subscribed Playlists

    @ViewBuilder
    private var subscribedPlaylistsSection: some View {
        if !account.subscribedPlaylists.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("收藏的歌单 (\(account.subscribedPlaylists.count))")
                        .font(.system(size: 16, weight: .bold))
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)

                LazyVStack(spacing: 4) {
                    ForEach(account.subscribedPlaylists) { playlist in
                        playlistRow(playlist)
                    }
                }
                .padding(.horizontal, 12)
            }
        }
    }

    private func playlistRow(_ playlist: PlaylistSummary) -> some View {
        NavigationLink(value: Destination.playlist(playlist.id)) {
            HStack(spacing: 12) {
                CachedAsyncImage(url: playlist.coverURL?.resizedImageURL(128))
                    .frame(width: 48, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 3) {
                    Text(playlist.name)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text("\(playlist.trackCount) 首 · by \(playlist.creator?.nickname ?? "网易云用户")")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var unloggedPrompt: some View {
        VStack(spacing: 16) {
            Image(systemName: "heart.circle")
                .font(.system(size: 52))
                .foregroundStyle(.tertiary)
            Text("登录网易云音乐查看你的音乐库")
                .font(.headline)
            Button("立即登录") {
                openLogin()
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accent)
        }
        .frame(maxWidth: .infinity, minHeight: 240)
    }
}
