import CoreImage.CIFilterBuiltins
import SwiftUI

struct LoginSheet: View {
    private enum Phase: Equatable {
        case loading
        case waiting          // 801
        case scanned(String)  // 802, nickname
        case expired          // 800
        case success
        case failed(String)
    }

    private enum Mode {
        case qr
        case cookie
    }

    @State private var mode: Mode = .qr
    @State private var phase: Phase = .loading
    @State private var qrImage: PlatformImage?
    @State private var pollTask: Task<Void, Never>?
    @State private var cookieText = ""
    @State private var cookieError: String?
    @State private var isLoggingInWithCookie = false

    @Environment(AccountStore.self) private var account
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Picker("登录方式", selection: $mode) {
                    Text("扫码登录").tag(Mode.qr)
                    Text("Cookie 登录").tag(Mode.cookie)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 260)
                .padding(.top, 12)

                if mode == .qr {
                    qrSection
                } else {
                    cookieSection
                }

                Spacer()
            }
            .padding(.horizontal, 24)
            .navigationTitle("登录网易云音乐")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                if mode == .qr { startLogin() }
            }
            .onDisappear { pollTask?.cancel() }
            .onChange(of: mode) { _, newMode in
                if newMode == .qr {
                    startLogin()
                } else {
                    pollTask?.cancel()
                }
            }
        }
        .frame(minWidth: 320, minHeight: 460)
    }

    // MARK: - QR Section

    private var qrSection: some View {
        VStack(spacing: 16) {
            Text("使用网易云音乐 App 扫码登录")
                .font(.system(size: 13))
                .foregroundStyle(.secondary)

            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.white)
                    .frame(width: 208, height: 208)
                    .shadow(color: .black.opacity(0.12), radius: 12, y: 4)

                if let qrImage {
                    Image(platformImage: qrImage)
                        .resizable()
                        .interpolation(.none)
                        .frame(width: 180, height: 180)
                        .blur(radius: overlayVisible ? 3 : 0)
                } else {
                    ProgressView()
                }

                if overlayVisible {
                    VStack(spacing: 10) {
                        switch phase {
                        case .expired:
                            Image(systemName: "arrow.clockwise.circle.fill")
                                .font(.system(size: 34))
                                .foregroundStyle(Theme.accent)
                            Text("二维码已失效")
                                .font(.system(size: 12, weight: .medium))
                            Button("刷新") {
                                startLogin()
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Theme.accent)
                            .controlSize(.small)
                        case .scanned(let nickname):
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 34))
                                .foregroundStyle(.green)
                            Text("已扫码")
                                .font(.system(size: 13, weight: .semibold))
                            Text("\(nickname)，请在手机上确认")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        default:
                            EmptyView()
                        }
                    }
                    .padding(12)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }

            Group {
                switch phase {
                case .loading:
                    Text("正在获取二维码…")
                case .waiting:
                    Text("打开网易云音乐 App，扫一扫登录")
                case .scanned:
                    Text("等待手机确认…")
                case .expired:
                    Text("二维码已失效，请刷新")
                case .success:
                    Text("登录成功！")
                case .failed(let message):
                    Text(message).foregroundStyle(Theme.accent)
                }
            }
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
        }
        .padding(.top, 10)
    }

    // MARK: - Cookie Section

    private var cookieSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("直接粘贴你的 MUSIC_U 或完整 Cookie 字符串：")
                .font(.system(size: 12.5))
                .foregroundStyle(.secondary)

            TextField("MUSIC_U=...", text: $cookieText, axis: .vertical)
                .lineLimit(4...6)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 12, design: .monospaced))

            if let cookieError {
                Text(cookieError)
                    .font(.caption)
                    .foregroundStyle(Theme.accent)
            }

            Button {
                loginWithCookie()
            } label: {
                if isLoggingInWithCookie {
                    ProgressView().controlSize(.small)
                } else {
                    Text("确认登录")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accent)
            .disabled(cookieText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoggingInWithCookie)
        }
        .padding(.top, 16)
    }

    private var overlayVisible: Bool {
        switch phase {
        case .expired, .scanned: return true
        default: return false
        }
    }

    private func startLogin() {
        pollTask?.cancel()
        phase = .loading
        qrImage = nil
        pollTask = Task {
            do {
                let unikey = try await NeteaseAPI.qrKey()
                let url = NeteaseAPI.qrLoginURL(unikey: unikey)
                qrImage = Self.generateQR(from: url)
                phase = .waiting

                while !Task.isCancelled {
                    try await Task.sleep(for: .seconds(1.2))
                    let check = try await NeteaseAPI.qrCheck(unikey: unikey)
                    switch check.code {
                    case 800:
                        phase = .expired
                        return
                    case 801:
                        if case .waiting = phase {} else { phase = .waiting }
                    case 802:
                        phase = .scanned(check.nickname ?? "")
                    case 803:
                        phase = .success
                        await account.bootstrap()
                        ToastCenter.shared.show(String(localized: "欢迎回来，\(account.profile?.nickname ?? "")"))
                        dismiss()
                        return
                    default:
                        break
                    }
                }
            } catch {
                if !Task.isCancelled {
                    phase = .failed(error.localizedDescription)
                }
            }
        }
    }

    private func loginWithCookie() {
        let trimmed = cookieText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isLoggingInWithCookie = true
        cookieError = nil

        Task {
            defer { isLoggingInWithCookie = false }
            NeteaseClient.shared.ingestCookieString(trimmed)
            await account.bootstrap()
            if account.isLoggedIn {
                ToastCenter.shared.show(String(localized: "欢迎回来，\(account.profile?.nickname ?? "")"))
                dismiss()
            } else {
                cookieError = String(localized: "Cookie 无效或已过期，请重新获取")
                NeteaseClient.shared.clearAuthCookies()
            }
        }
    }

    private static func generateQR(from string: String) -> PlatformImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        let context = CIContext()
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        #if os(macOS)
        return NSImage(cgImage: cgImage, size: NSSize(width: 180, height: 180))
        #else
        return UIImage(cgImage: cgImage)
        #endif
    }
}
