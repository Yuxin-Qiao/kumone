import SwiftUI

// MARK: - Cover card (playlists / albums)

struct CoverCard: View {
    let coverURL: URL?
    let title: String
    var subtitle: String?
    var playCount: Int = 0
    var size: CGFloat = Theme.Layout.cardSize
    var onPlay: (() -> Void)?
    let onOpen: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: onOpen) {
            CoverCardBody(
                coverURL: coverURL,
                title: title,
                subtitle: subtitle,
                playCount: playCount,
                size: size,
                onPlay: onPlay
            )
        }
        .buttonStyle(.interactiveCard)
    }
}

// MARK: - Artist card (circular)

struct ArtistCard: View {
    let artist: ArtistSummary
    var size: CGFloat = 110
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(spacing: 8) {
                CachedAsyncImage(url: artist.picUrl?.resizedImageURL(256))
                    .frame(width: size, height: size)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(.primary.opacity(0.08), lineWidth: 0.5))
                    .shadow(color: .black.opacity(0.1), radius: 6, y: 2)

                Text(artist.name)
                    .font(.system(size: 12.5, weight: .medium))
                    .lineLimit(1)
                    .foregroundStyle(.primary)
            }
            .frame(width: size + 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.interactiveCard)
    }
}

// MARK: - Horizontal shelf

/// A horizontal scroll section whose track reaches the column edges;
/// the resting inset lives inside the HStack.
struct Shelf<Content: View>: View {
    let title: LocalizedStringKey
    var seeAll: (() -> Void)?
    var spacing: CGFloat = 14
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: title, action: seeAll)
                .padding(.horizontal, Theme.Layout.contentInset)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: spacing) {
                    Spacer().frame(width: Theme.Layout.contentInset - spacing)
                    content()
                    Spacer().frame(width: Theme.Layout.contentInset - spacing)
                }
            }
        }
    }
}

// MARK: - Adaptive card grid

struct CardGrid<Content: View>: View {
    var minWidth: CGFloat = Theme.Layout.cardSize
    @ViewBuilder var content: () -> Content

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: minWidth, maximum: minWidth + 50),
                               spacing: 16, alignment: .top)],
            alignment: .leading, spacing: 20
        ) {
            content()
        }
    }
}

// MARK: - Error / empty states

struct ErrorStateView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label("加载失败", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            Button("重试", action: retry)
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
        }
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: LocalizedStringKey
    var subtitle: LocalizedStringKey?

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(.tertiary)
            Text(title)
                .font(.headline)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
