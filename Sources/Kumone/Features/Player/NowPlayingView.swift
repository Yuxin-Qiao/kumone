import SwiftUI

/// Immersive now-playing page: artwork-tinted gradient backdrop,
/// dynamic responsive layout for iPhone, iPad, and macOS.
struct NowPlayingView: View {
    @Environment(PlayerService.self) private var player
    @Environment(AccountStore.self) private var account
    @Environment(SettingsManager.self) private var settings
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    #endif

    @State private var artworkImage: PlatformImage?
    @State private var colors: ArtworkColors = .fallback
    @State private var activeIndex: Int?
    @State private var isUserScrolling = false
    @State private var resumeTask: Task<Void, Never>?
    @State private var showLyricsOnMobile = false
    @State private var showQueueSheet = false

    private var isCompact: Bool {
        #if os(iOS)
        return horizontalSizeClass == .compact
        #else
        return false
        #endif
    }

    var body: some View {
        ZStack {
            backdrop

            if isCompact {
                mobileLayout
            } else {
                desktopLayout
            }
        }
        .preferredColorScheme(.dark)
        .task(id: player.currentTrack?.id) {
            await loadArtwork()
        }
        #if os(macOS)
        .onExitCommand {
            close()
        }
        #endif
        .sheet(isPresented: $showQueueSheet) {
            mobileQueueSheet
        }
    }

    private func close() {
        withAnimation(AppAnimation.smooth) {
            player.showNowPlaying = false
        }
    }

    // MARK: - Backdrop

    private var backdrop: some View {
        ZStack {
            LinearGradient(
                colors: [colors.primary, colors.secondary],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [.white.opacity(0.12), .clear],
                center: .topLeading, startRadius: 0, endRadius: 700
            )
            LinearGradient(
                colors: [.clear, .black.opacity(0.4)],
                startPoint: .top, endPoint: .bottom
            )
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 0.8), value: colors)
    }

    private func loadArtwork() async {
        guard let urlString = player.currentTrack?.album.picUrl,
              let url = urlString.resizedImageURL(768) else {
            artworkImage = nil
            colors = .fallback
            return
        }
        if let image = await ImageCache.shared.image(for: url) {
            artworkImage = image
            colors = ArtworkPalette.extract(from: image, cacheKey: urlString)
        }
    }

    // MARK: - Desktop / Regular Layout (Side-by-Side)

    private var desktopLayout: some View {
        ZStack {
            HStack(spacing: 0) {
                leftColumn
                    .frame(maxWidth: .infinity)
                if hasLyricsColumn {
                    lyricsColumn
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 48)
            .padding(.vertical, 40)
        }
        .overlay(alignment: .topLeading) {
            dismissButton
                .padding(.top, 16)
                .padding(.leading, 20)
        }
    }

    private var hasLyricsColumn: Bool {
        if let lyrics = player.lyrics, !lyrics.isEmpty { return true }
        return player.lyrics == nil
    }

    private var dismissButton: some View {
        Button {
            close()
        } label: {
            Image(systemName: "chevron.down")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white.opacity(0.85))
                .frame(width: 34, height: 34)
                .background(.white.opacity(0.14), in: Circle())
        }
        .buttonStyle(.pressable)
    }

    private var leftColumn: some View {
        VStack(spacing: 26) {
            Spacer()

            artworkView(size: 340)

            trackMetadata(titleSize: 21, subSize: 13.5)

            VStack(spacing: 14) {
                NowPlayingScrubber()
                    .frame(maxWidth: 380)
                controls
            }

            Spacer()
        }
        .padding(.trailing, hasLyricsColumn ? 30 : 0)
    }

    // MARK: - Mobile / Compact Layout

    private var mobileLayout: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                dismissButton
                Spacer()
                VStack(spacing: 2) {
                    Text(showLyricsOnMobile ? "歌词" : "正在播放")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.5))
                        .textCase(.uppercase)
                    if let albumName = player.currentTrack?.album.name {
                        Text(albumName)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.85))
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: 200)
                Spacer()
                // Balance header space
                Color.clear.frame(width: 34, height: 34)
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)

            if showLyricsOnMobile {
                lyricsColumn
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, 10)
            } else {
                Spacer(minLength: 12)

                GeometryReader { geo in
                    let size = min(geo.size.width - 48, geo.size.height - 10, 320)
                    artworkView(size: max(size, 200))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .frame(maxHeight: 340)

                Spacer(minLength: 12)

                VStack(spacing: 18) {
                    trackMetadata(titleSize: 20, subSize: 14)
                        .padding(.horizontal, 28)

                    NowPlayingScrubber()
                        .padding(.horizontal, 28)

                    mobileControls
                        .padding(.horizontal, 20)

                    mobileBottomBar
                        .padding(.horizontal, 28)
                        .padding(.top, 4)
                }
                .padding(.bottom, 24)
            }

            if showLyricsOnMobile {
                // Bottom toggle in lyrics mode
                HStack {
                    Button {
                        withAnimation(AppAnimation.smooth) {
                            showLyricsOnMobile = false
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "music.note")
                            Text("返回封面")
                        }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.85))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.white.opacity(0.15), in: Capsule())
                    }
                    .buttonStyle(.pressable)

                    Spacer()

                    Button {
                        player.togglePlayPause()
                    } label: {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(Theme.accent, in: Circle())
                    }
                    .buttonStyle(.pressable)
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 20)
            }
        }
        #if os(iOS)
        .gesture(
            DragGesture().onEnded { value in
                if value.translation.height > 120 {
                    close()
                }
            }
        )
        #endif
    }

    private func artworkView(size: CGFloat) -> some View {
        Group {
            if let artworkImage {
                Image(platformImage: artworkImage)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                Rectangle()
                    .fill(.white.opacity(0.06))
                    .overlay(
                        Image(systemName: "music.note")
                            .font(.system(size: 48, weight: .light))
                            .foregroundStyle(.white.opacity(0.3))
                    )
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.45), radius: 32, y: 16)
        .scaleEffect(player.isPlaying ? 1 : 0.94)
        .animation(AppAnimation.bouncy, value: player.isPlaying)
    }

    private func trackMetadata(titleSize: CGFloat, subSize: CGFloat) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(player.currentTrack?.name ?? "")
                        .font(.system(size: titleSize, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if player.currentTrack?.fee == 1 {
                        VIPBadge()
                    }
                }
                Text("\(player.currentTrack?.artistNames ?? "") — \(player.currentTrack?.album.name ?? "")")
                    .font(.system(size: subSize))
                    .foregroundStyle(.white.opacity(0.68))
                    .lineLimit(1)
            }
            Spacer()
            if let track = player.currentTrack {
                let liked = account.isLiked(track.id)
                Button {
                    Task { await account.toggleLike(trackID: track.id) }
                } label: {
                    Image(systemName: liked ? "heart.fill" : "heart")
                        .font(.system(size: 20))
                        .foregroundStyle(liked ? Theme.accent : .white.opacity(0.8))
                        .frame(width: 38, height: 38)
                        .background(.white.opacity(0.1), in: Circle())
                }
                .buttonStyle(.pressable)
            }
        }
        .frame(maxWidth: 440)
    }

    // MARK: - Controls

    private var controls: some View {
        HStack(spacing: 22) {
            if let track = player.currentTrack {
                let liked = account.isLiked(track.id)
                circleButton(
                    icon: liked ? "heart.fill" : "heart",
                    size: 15, tint: liked ? Theme.accent : nil
                ) {
                    Task { await account.toggleLike(trackID: track.id) }
                }
            }

            if player.isFMMode {
                circleButton(icon: "trash", size: 14) {
                    player.fmTrash()
                }
            } else {
                circleButton(icon: "backward.fill", size: 16) {
                    player.previous()
                }
            }

            Button {
                player.togglePlayPause()
            } label: {
                ZStack {
                    Circle()
                        .fill(.white)
                        .frame(width: 58, height: 58)
                        .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 21, weight: .bold))
                        .foregroundStyle(.black.opacity(0.85))
                        .contentTransition(.symbolEffect(.replace))
                }
            }
            .buttonStyle(.pressable)

            circleButton(icon: "forward.fill", size: 16) {
                player.next()
            }

            if player.isFMMode {
                Image(systemName: "wave.3.right.circle.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.5))
                    .frame(width: 40, height: 40)
            } else {
                circleButton(
                    icon: player.shuffleEnabled ? "shuffle" : (player.repeatMode == .one ? "repeat.1" : "repeat"),
                    size: 14,
                    tint: player.shuffleEnabled || player.repeatMode != .off ? Theme.accent : nil
                ) {
                    if player.shuffleEnabled {
                        player.toggleShuffle()
                    } else {
                        player.cycleRepeatMode()
                    }
                }
            }
        }
    }

    private var mobileControls: some View {
        HStack(spacing: 20) {
            if player.isFMMode {
                Button { player.fmTrash() } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 18))
                        .foregroundStyle(.white.opacity(0.8))
                }
                .buttonStyle(.pressable)
            } else {
                Button {
                    player.toggleShuffle()
                } label: {
                    Image(systemName: "shuffle")
                        .font(.system(size: 18))
                        .foregroundStyle(player.shuffleEnabled ? Theme.accent : .white.opacity(0.55))
                }
                .buttonStyle(.pressable)
            }

            Spacer()

            Button {
                player.previous()
            } label: {
                Image(systemName: "backward.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(.white)
            }
            .buttonStyle(.pressable)

            Spacer()

            Button {
                player.togglePlayPause()
            } label: {
                ZStack {
                    Circle()
                        .fill(.white)
                        .frame(width: 64, height: 64)
                        .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.black.opacity(0.88))
                        .contentTransition(.symbolEffect(.replace))
                }
            }
            .buttonStyle(.pressable)

            Spacer()

            Button {
                player.next()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(.white)
            }
            .buttonStyle(.pressable)

            Spacer()

            if player.isFMMode {
                Image(systemName: "wave.3.right.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Theme.accent)
            } else {
                Button {
                    player.cycleRepeatMode()
                } label: {
                    Image(systemName: player.repeatMode == .one ? "repeat.1" : "repeat")
                        .font(.system(size: 18))
                        .foregroundStyle(player.repeatMode != .off ? Theme.accent : .white.opacity(0.55))
                }
                .buttonStyle(.pressable)
            }
        }
    }

    private var mobileBottomBar: some View {
        HStack(spacing: 24) {
            Button {
                withAnimation(AppAnimation.smooth) {
                    showLyricsOnMobile.toggle()
                }
            } label: {
                Image(systemName: "quote.bubble")
                    .font(.system(size: 18))
                    .foregroundStyle(showLyricsOnMobile ? Theme.accent : .white.opacity(0.75))
            }
            .buttonStyle(.pressable)

            if let level = player.servedQuality, let quality = AudioQuality(rawValue: level) {
                QualityTag(text: quality.badge)
            } else if player.unblockSource != nil {
                QualityTag(text: "音源")
            }

            Spacer()

            Button {
                showQueueSheet = true
            } label: {
                Image(systemName: "list.bullet")
                    .font(.system(size: 18))
                    .foregroundStyle(.white.opacity(0.75))
            }
            .buttonStyle(.pressable)
        }
    }

    private func circleButton(icon: String, size: CGFloat,
                              tint: Color? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: size, weight: .medium))
                .foregroundStyle(tint ?? .white.opacity(0.8))
                .frame(width: 40, height: 40)
                .background(.white.opacity(0.1), in: Circle())
        }
        .buttonStyle(.pressable)
    }

    // MARK: - Lyrics Column

    @ViewBuilder
    private var lyricsColumn: some View {
        if let lyrics = player.lyrics, !lyrics.isEmpty {
            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 24) {
                        Color.clear.frame(height: 160)
                        ForEach(lyrics.lines) { line in
                            bigLyricLine(line, isActive: line.id == activeIndex)
                                .id(line.id)
                        }
                        Color.clear.frame(height: 200)
                    }
                    .padding(.horizontal, 24)
                }
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0),
                            .init(color: .black, location: 0.1),
                            .init(color: .black, location: 0.88),
                            .init(color: .clear, location: 1),
                        ],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .onChange(of: player.progress) {
                    let index = lyrics.activeIndex(at: player.progress + 0.2)
                    guard index != activeIndex else { return }
                    activeIndex = index
                    guard !isUserScrolling, let index else { return }
                    withAnimation(.spring(response: 0.8, dampingFraction: 0.85)) {
                        proxy.scrollTo(index, anchor: .center)
                    }
                }
                .onChange(of: player.currentTrack?.id) {
                    activeIndex = nil
                }
                .simultaneousGesture(
                    DragGesture().onChanged { _ in
                        isUserScrolling = true
                        resumeTask?.cancel()
                        resumeTask = Task {
                            try? await Task.sleep(for: .seconds(3))
                            guard !Task.isCancelled else { return }
                            isUserScrolling = false
                        }
                    }
                )
            }
        } else if player.lyrics?.isInstrumental == true {
            VStack(spacing: 10) {
                Image(systemName: "music.quarternote.3")
                    .font(.system(size: 36, weight: .light))
                    .foregroundStyle(.white.opacity(0.4))
                Text("纯音乐，请欣赏")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ProgressView()
                .controlSize(.small)
                .tint(.white)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func bigLyricLine(_ line: LyricLine, isActive: Bool) -> some View {
        Button {
            player.seek(to: line.time)
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                Text(line.text.isEmpty ? "♪" : line.text)
                    .font(.system(size: isActive ? 24 : 19, weight: isActive ? .bold : .semibold))
                    .foregroundStyle(.white.opacity(isActive ? 1 : 0.45))
                if settings.showLyricsTranslation, let translation = line.translation {
                    Text(translation)
                        .font(.system(size: isActive ? 15 : 13, weight: .medium))
                        .foregroundStyle(.white.opacity(isActive ? 0.7 : 0.35))
                }
            }
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .blur(radius: isActive ? 0 : 0.6)
            .scaleEffect(isActive ? 1.02 : 1, anchor: .leading)
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isActive)
    }

    // MARK: - Mobile Queue Sheet

    private var mobileQueueSheet: some View {
        NavigationStack {
            QueuePanel()
                .navigationTitle("播放队列")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("完成") {
                            showQueueSheet = false
                        }
                    }
                }
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: - Scrubber (white-on-dark variant)

struct NowPlayingScrubber: View {
    @Environment(PlayerService.self) private var player

    @State private var isHovering = false
    @State private var isDragging = false
    @State private var dragProgress: Double = 0

    private var fraction: Double {
        guard player.duration > 0 else { return 0 }
        let value = isDragging ? dragProgress : player.progress
        return min(max(value / player.duration, 0), 1)
    }

    var body: some View {
        VStack(spacing: 5) {
            GeometryReader { geo in
                let width = geo.size.width
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(.white.opacity(0.25))
                        .frame(height: 4)
                    Capsule()
                        .fill(.white)
                        .frame(width: max(4, width * fraction), height: 4)
                    Circle()
                        .fill(.white)
                        .frame(width: thumbDiameter, height: thumbDiameter)
                        .shadow(color: .black.opacity(0.3), radius: 2, y: 1)
                        .offset(x: width * fraction - thumbDiameter / 2)
                        .opacity(isHovering || isDragging ? 1 : 0)
                }
                .frame(maxHeight: .infinity)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            guard player.duration > 0 else { return }
                            isDragging = true
                            player.isScrubbing = true
                            dragProgress = min(max(value.location.x / width, 0), 1) * player.duration
                        }
                        .onEnded { _ in
                            player.seek(to: dragProgress)
                            isDragging = false
                            player.isScrubbing = false
                        }
                )
            }
            .frame(height: 14)
            .onHover { hovering in
                withAnimation(AppAnimation.quick) { isHovering = hovering }
            }

            HStack {
                Text(Formatters.duration(isDragging ? dragProgress : player.progress))
                Spacer()
                Text(Formatters.duration(player.duration))
            }
            .font(.system(size: 10.5).monospacedDigit())
            .foregroundStyle(.white.opacity(0.55))
        }
    }

    private var thumbDiameter: CGFloat {
        isDragging ? 13 : (isHovering ? 11 : 9)
    }
}
