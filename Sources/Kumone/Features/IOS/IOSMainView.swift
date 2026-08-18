import SwiftUI

enum IOSTab: Hashable, CaseIterable {
    case home
    case explore
    case fm
    case search
    case library

    var title: String {
        switch self {
        case .home: return "推荐"
        case .explore: return "精选"
        case .fm: return "漫游"
        case .search: return "搜索"
        case .library: return "我的"
        }
    }

    var icon: String {
        switch self {
        case .home: return "house.fill"
        case .explore: return "square.grid.2x2.fill"
        case .fm: return "wave.3.right.circle.fill"
        case .search: return "magnifyingglass"
        case .library: return "person.crop.circle.fill"
        }
    }
}

/// Custom sleek native iOS root container.
struct IOSMainView: View {
    @Environment(PlayerService.self) private var player
    @Environment(AccountStore.self) private var account
    @Environment(SettingsManager.self) private var settings
    @Environment(ToastCenter.self) private var toasts

    @State private var selectedTab: IOSTab = .home
    @State private var showLogin = false

    private var bottomPadding: CGFloat {
        (player.hasCurrentTrack ? 128 : 64)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Main content tabs
            Group {
                switch selectedTab {
                case .home:
                    NavigationStack {
                        HomeView()
                            .safeAreaPadding(.bottom, bottomPadding)
                            .appDestinations()
                    }
                case .explore:
                    NavigationStack {
                        ExploreView()
                            .safeAreaPadding(.bottom, bottomPadding)
                            .appDestinations()
                    }
                case .fm:
                    NavigationStack {
                        FMView()
                            .safeAreaPadding(.bottom, bottomPadding)
                            .appDestinations()
                    }
                case .search:
                    NavigationStack {
                        IOSSearchView()
                            .safeAreaPadding(.bottom, bottomPadding)
                            .appDestinations()
                    }
                case .library:
                    NavigationStack {
                        IOSLibraryView()
                            .safeAreaPadding(.bottom, bottomPadding)
                            .appDestinations()
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Bottom Player & TabBar
            VStack(spacing: 8) {
                MiniPlayerBar()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(AppAnimation.spring, value: player.hasCurrentTrack)

                customTabBar
            }
        }
        .ignoresSafeArea(.keyboard)
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
                    .padding(.top, 56)
            }
        }
        .animation(.spring(duration: 0.3), value: toasts.current)
    }

    // MARK: - Custom Glass Tab Bar

    private var customTabBar: some View {
        HStack(spacing: 0) {
            ForEach(IOSTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(AppAnimation.snappy) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 21, weight: selectedTab == tab ? .semibold : .regular))
                            .scaleEffect(selectedTab == tab ? 1.08 : 1.0)

                        Text(tab.title)
                            .font(.system(size: 10.5, weight: selectedTab == tab ? .semibold : .medium))
                    }
                    .foregroundStyle(selectedTab == tab ? Theme.accent : .secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.bottom, 2)
        .background(
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        )
        .overlay(alignment: .top) {
            Divider()
                .opacity(0.3)
        }
    }
}

/// Standalone search tab page for iOS with trending chips and history.
struct IOSSearchView: View {
    @State private var query = ""
    @State private var activeSearchQuery = ""
    @State private var defaultKeyword = "搜索音乐、歌手、专辑"
    @State private var hotSearches: [String] = [
        "周杰伦", "陈奕迅", "林俊杰", "邓紫棋", "Taylor Swift",
        "落", "告白气球", "晴天", "起风了", "瞬"
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if activeSearchQuery.isEmpty {
                    hotSearchSection
                } else {
                    SearchView(query: activeSearchQuery)
                }
            }
            .padding(.top, 8)
        }
        .navigationTitle("搜索")
        .searchable(text: $query, prompt: defaultKeyword)
        .onSubmit(of: .search) {
            triggerSearch()
        }
        .onChange(of: query) { _, newQuery in
            if newQuery.isEmpty {
                activeSearchQuery = ""
            }
        }
        .task {
            if let keyword = try? await NeteaseAPI.searchDefaultKeyword(), !keyword.isEmpty {
                defaultKeyword = keyword
            }
        }
    }

    private func triggerSearch(with text: String? = nil) {
        let target = text ?? query
        let trimmed = target.trimmingCharacters(in: .whitespaces)
        let effective = trimmed.isEmpty ? defaultKeyword : trimmed
        guard !effective.isEmpty else { return }
        query = effective
        activeSearchQuery = effective
    }

    private var hotSearchSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("热门搜索")
                .font(.system(size: 15, weight: .bold))
                .padding(.horizontal, 16)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(Array(hotSearches.enumerated()), id: \.offset) { index, keyword in
                    Button {
                        triggerSearch(with: keyword)
                    } label: {
                        HStack(spacing: 8) {
                            Text("\(index + 1)")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(index < 3 ? Theme.accent : .secondary)
                                .frame(width: 18)

                            Text(keyword)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.primary)
                                .lineLimit(1)

                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Color.primary.opacity(0.04))
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.pressable)
                }
            }
            .padding(.horizontal, 16)
        }
    }
}
