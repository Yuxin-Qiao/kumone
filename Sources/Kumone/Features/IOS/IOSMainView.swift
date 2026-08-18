import SwiftUI

enum IOSTab: Hashable {
    case home
    case explore
    case fm
    case search
    case library
}

/// Root container for iOS with TabView, MiniPlayerBar, and NowPlayingView.
struct IOSMainView: View {
    @Environment(PlayerService.self) private var player
    @Environment(AccountStore.self) private var account
    @Environment(SettingsManager.self) private var settings
    @Environment(ToastCenter.self) private var toasts

    @State private var selectedTab: IOSTab = .home
    @State private var showLogin = false
    @State private var searchQuery = ""

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                NavigationStack {
                    HomeView()
                        .playerContentInset()
                        .appDestinations()
                }
                .tabItem {
                    Label("推荐", systemImage: "house.fill")
                }
                .tag(IOSTab.home)

                NavigationStack {
                    ExploreView()
                        .playerContentInset()
                        .appDestinations()
                }
                .tabItem {
                    Label("精选", systemImage: "square.grid.2x2.fill")
                }
                .tag(IOSTab.explore)

                NavigationStack {
                    FMView()
                        .playerContentInset()
                        .appDestinations()
                }
                .tabItem {
                    Label("漫游", systemImage: "wave.3.right.circle.fill")
                }
                .tag(IOSTab.fm)

                NavigationStack {
                    IOSSearchView()
                        .playerContentInset()
                        .appDestinations()
                }
                .tabItem {
                    Label("搜索", systemImage: "magnifyingglass")
                }
                .tag(IOSTab.search)

                NavigationStack {
                    IOSLibraryView()
                        .playerContentInset()
                        .appDestinations()
                }
                .tabItem {
                    Label("我的", systemImage: "person.crop.circle.fill")
                }
                .tag(IOSTab.library)
            }

            // Mini player docked above tab bar
            MiniPlayerBar()
                .padding(.bottom, 50)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .animation(AppAnimation.spring, value: player.hasCurrentTrack)
        }
        .environment(\.openLogin, { showLogin = true })
        .task {
            await account.bootstrap()
        }
        .sheet(isPresented: $showLogin) {
            LoginSheet()
        }
        #if os(iOS)
        .fullScreenCover(isPresented: Bindable(player).showNowPlaying) {
            NowPlayingView()
        }
        #else
        .sheet(isPresented: Bindable(player).showNowPlaying) {
            NowPlayingView()
        }
        #endif
        .overlay(alignment: .top) {
            if let toast = toasts.current {
                ToastView(toast: toast)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .padding(.top, 48)
            }
        }
        .animation(.spring(duration: 0.3), value: toasts.current)
    }
}

/// Standalone search tab page for iOS.
struct IOSSearchView: View {
    @State private var query = ""
    @State private var activeSearchQuery = ""
    @State private var defaultKeyword = "搜索音乐、歌手、专辑"

    var body: some View {
        Group {
            if activeSearchQuery.isEmpty {
                VStack(spacing: 20) {
                    Spacer()
                    Image(systemName: "magnifyingglass.circle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(Theme.accent.opacity(0.8))
                    Text("搜索网易云音乐海量曲库")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
            } else {
                SearchView(query: activeSearchQuery)
            }
        }
        .navigationTitle("搜索")
        .searchable(text: $query, prompt: defaultKeyword)
        .onSubmit(of: .search) {
            let trimmed = query.trimmingCharacters(in: .whitespaces)
            let effective = trimmed.isEmpty ? defaultKeyword : trimmed
            guard !effective.isEmpty else { return }
            activeSearchQuery = effective
        }
        .task {
            if let keyword = try? await NeteaseAPI.searchDefaultKeyword(), !keyword.isEmpty {
                defaultKeyword = keyword
            }
        }
    }
}
