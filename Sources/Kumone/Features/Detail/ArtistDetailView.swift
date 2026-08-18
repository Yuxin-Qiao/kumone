import SwiftUI

struct ArtistDetailView: View {
    let artistID: Int

    @State private var artist: ArtistSummary?
    @State private var hotSongs: [Track] = []
    @State private var albums: [AlbumSummary] = []
    @State private var epsAndSingles: [AlbumSummary] = []
    @State private var similar: [ArtistSummary] = []
    @State private var isFollowed = false
    @State private var showAllSongs = false
    @State private var isLoading = true
    @State private var errorMessage: String?

    @Environment(PlayerService.self) private var player
    @Environment(AccountStore.self) private var account

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                if let artist {
                    header(artist)
                        .padding(.horizontal, Theme.Layout.contentInset)
                        .padding(.top, 16)

                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeader(title: "热门歌曲")
                            .padding(.horizontal, Theme.Layout.contentInset)
                        TrackListView(
                            tracks: Array(hotSongs.prefix(showAllSongs ? 50 : 10)),
                            style: .compact,
                            source: .artist(artistID)
                        )
                        .padding(.horizontal, Theme.Layout.contentInset - 10)
                        if hotSongs.count > 10 {
                            Button(showAllSongs ? String(localized: "收起") : String(localized: "查看更多")) {
                                withAnimation(AppAnimation.standard) {
                                    showAllSongs.toggle()
                                }
                            }
                            .buttonStyle(.plain)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, Theme.Layout.contentInset)
                        }
                    }

                    if !albums.isEmpty {
                        Shelf(title: "专辑") {
                            ForEach(albums) { album in
                                albumCard(album)
                            }
                        }
                    }

                    if !epsAndSingles.isEmpty {
                        Shelf(title: "EP 与单曲") {
                            ForEach(epsAndSingles) { album in
                                albumCard(album)
                            }
                        }
                    }

                    if !similar.isEmpty {
                        Shelf(title: "相似歌手") {
                            ForEach(similar.prefix(10)) { other in
                                NavigationLink(value: Destination.artist(other.id)) {
                                    VStack(spacing: 10) {
                                        CachedAsyncImage(url: other.picUrl?.resizedImageURL(256))
                                            .frame(width: 128, height: 128)
                                            .clipShape(Circle())
                                        Text(other.name)
                                            .font(.system(size: 13, weight: .medium))
                                            .foregroundStyle(.primary)
                                            .lineLimit(1)
                                    }
                                    .frame(width: 140)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.interactiveCard)
                            }
                        }
                    }
                } else if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 400)
                } else if let errorMessage {
                    ErrorStateView(message: errorMessage) {
                        Task { await load() }
                    }
                    .frame(minHeight: 400)
                }
                Color.clear.frame(height: 8)
            }
        }
        .navigationTitle(artist?.name ?? String(localized: "歌手"))
        .task(id: artistID) {
            await load()
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await NeteaseAPI.artist(id: artistID)
            artist = response.artist
            hotSongs = response.hotSongs
            isFollowed = response.artist.followed
            isLoading = false

            if let result = try? await NeteaseAPI.artistAlbums(id: artistID, limit: 60) {
                albums = result.hotAlbums.filter { $0.size > 1 }
                epsAndSingles = result.hotAlbums.filter { $0.size <= 1 }
            }
            if account.isLoggedIn {
                similar = (try? await NeteaseAPI.similarArtists(id: artistID)) ?? []
            }
        } catch {
            isLoading = false
            errorMessage = error.localizedDescription
        }
    }

    private func header(_ artist: ArtistSummary) -> some View {
        HStack(alignment: .center, spacing: 28) {
            CachedAsyncImage(url: artist.picUrl?.resizedImageURL(512))
                .frame(width: 180, height: 180)
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.25), radius: 16, y: 8)

            VStack(alignment: .leading, spacing: 8) {
                Text("歌手")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Text(artist.name)
                    .font(.largeTitle.weight(.bold))
                if !artist.alias.isEmpty {
                    Text(artist.alias.joined(separator: " / "))
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
                Text("\(artist.musicSize) 首歌曲 · \(artist.albumSize) 张专辑")
                    .font(.system(size: 11.5))
                    .foregroundStyle(.tertiary)

                Spacer(minLength: 6)

                HStack(spacing: 10) {
                    Button {
                        player.play(tracks: hotSongs, source: .artist(artistID))
                    } label: {
                        Label("播放热门", systemImage: "play.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 8)
                            .background(Theme.accentGradient, in: Capsule())
                            .shadow(color: Theme.accent.opacity(0.3), radius: 6, y: 2)
                    }
                    .buttonStyle(.pressable)

                    if account.isLoggedIn {
                        Button {
                            toggleFollow()
                        } label: {
                            Label(isFollowed ? String(localized: "已关注") : String(localized: "关注"),
                                  systemImage: isFollowed ? "checkmark" : "plus")
                                .font(.system(size: 13, weight: .medium))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(.primary.opacity(0.06), in: Capsule())
                        }
                        .buttonStyle(.pressable)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func albumCard(_ album: AlbumSummary) -> some View {
        NavigationLink(value: Destination.album(album.id)) {
            CoverCardBody(
                coverURL: album.picUrl?.resizedImageURL(384),
                title: album.name,
                subtitle: album.publishYear
            )
        }
        .buttonStyle(.interactiveCard)
    }

    private func toggleFollow() {
        Task {
            do {
                try await NeteaseAPI.subscribeArtist(id: artistID, subscribe: !isFollowed)
                isFollowed.toggle()
                ToastCenter.shared.show(isFollowed ? String(localized: "已关注歌手") : String(localized: "已取消关注"))
            } catch {
                ToastCenter.shared.show(error.localizedDescription)
            }
        }
    }
}
