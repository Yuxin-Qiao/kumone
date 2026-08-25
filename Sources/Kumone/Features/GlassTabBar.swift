#if os(iOS)
import SwiftUI

/// A floating capsule tab bar for iOS 16–25 (older systems have no Liquid
/// Glass). It approximates it: a blurred material capsule with an edge
/// highlight and hairline rim, and a **sliding glass lozenge** behind the
/// active tab (matchedGeometryEffect) that reads like a real raised glass
/// chip — brighter and more opaque than the bar itself so it lifts, the way
/// Telegram's selected pill does.
struct GlassTabBar: View {
    struct Item: Identifiable {
        let tab: IOSTab
        let title: LocalizedStringKey
        let icon: String
        var id: IOSTab { tab }
    }

    let items: [Item]
    @Binding var selection: IOSTab
    var onReselect: (IOSTab) -> Void = { _ in }

    @Namespace private var pillNamespace
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 4) {
            ForEach(items) { item in
                tabButton(item)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background { glassCapsule }
        .overlay {
            Capsule().strokeBorder(
                LinearGradient(colors: [.white.opacity(0.45), .white.opacity(0.05)],
                               startPoint: .top, endPoint: .bottom),
                lineWidth: 0.7
            )
        }
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.24), radius: 18, y: 8)
        .padding(.horizontal, 40)
        .animation(.spring(response: 0.36, dampingFraction: 0.72), value: selection)
    }

    private func tabButton(_ item: GlassTabBar.Item) -> some View {
        let isSelected = selection == item.tab
        return Button {
            if isSelected {
                onReselect(item.tab)
            } else {
                selection = item.tab
            }
        } label: {
            VStack(spacing: 3) {
                Image(systemName: item.icon)
                    .font(.system(size: 18, weight: .semibold))
                    .symbolVariant(isSelected ? .fill : .none)
                Text(item.title)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .medium))
            }
            .foregroundStyle(isSelected ? AnyShapeStyle(Theme.accent) : AnyShapeStyle(.secondary))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .background {
                if isSelected {
                    glassLozenge
                        .matchedGeometryEffect(id: "activePill", in: pillNamespace)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// The sliding selection lozenge — a raised glass chip. It sits on
    /// `.regularMaterial` (more opaque than the bar's ultra-thin blur) plus a
    /// bright, scheme-aware wash so it clearly lifts off the bar, topped with
    /// a specular highlight and a soft drop shadow for dimension.
    private var glassLozenge: some View {
        let isDark = colorScheme == .dark
        return RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(.regularMaterial)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.white.opacity(isDark ? 0.14 : 0.60))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(
                    LinearGradient(
                        colors: [.white.opacity(isDark ? 0.30 : 0.75), .clear],
                        startPoint: .top, endPoint: .center
                    )
                )
                .blendMode(.plusLighter)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(.white.opacity(isDark ? 0.28 : 0.65), lineWidth: 0.7)
            )
            .shadow(color: .black.opacity(isDark ? 0.38 : 0.14), radius: 5, y: 2)
    }

    @ViewBuilder
    private var glassCapsule: some View {
        ZStack {
            Capsule().fill(.ultraThinMaterial)
            LinearGradient(colors: [.white.opacity(0.20), .white.opacity(0.02), .clear],
                           startPoint: .top, endPoint: .center)
                .clipShape(Capsule())
                .blendMode(.plusLighter)
        }
    }
}
#endif
