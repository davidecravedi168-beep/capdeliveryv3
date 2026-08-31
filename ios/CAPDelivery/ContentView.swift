import SwiftUI
import WebKit
import UIKit

private enum CAPURLs {
    static let base: URL = {
        let configured = Bundle.main.object(forInfoDictionaryKey: "CAP_BASE_URL") as? String
        let fallback = "https://davidecravedi168-beep.github.io/capdeliveryv3/"
        return URL(string: configured?.isEmpty == false ? configured! : fallback)!
    }()
}

final class CAPBrowserModel: ObservableObject {
    @Published var isLoading = false
    @Published var loadFailed = false
    @Published var reloadToken = UUID()

    func reload() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        loadFailed = false
        reloadToken = UUID()
    }
}

struct ContentView: View {
    var body: some View {
        TabView {
            OperationsView()
                .tabItem { Label("Operativo", systemImage: "shippingbox.fill") }

            TrustView()
                .tabItem { Label("Trust", systemImage: "shield.checkered") }
        }
    }
}

struct OperationsView: View {
    @StateObject private var model = CAPBrowserModel()

    var body: some View {
        NavigationStack {
            ZStack {
                CAPWebContainer(model: model)
                    .ignoresSafeArea(edges: .bottom)

                if model.isLoading {
                    ProgressView()
                        .padding(12)
                        .background(.thinMaterial, in: Capsule())
                }

                if model.loadFailed {
                    ContentUnavailableView {
                        Label("Sistema non raggiungibile", systemImage: "network.slash")
                    } description: {
                        Text("Fail-closed: se CAP non raggiunge il sistema operativo, non mostra dati locali come se fossero live.")
                    } actions: {
                        Button("Riprova") { model.reload() }
                            .buttonStyle(.borderedProminent)
                    }
                    .padding()
                    .background(.regularMaterial)
                }
            }
            .navigationTitle("CAP Delivery")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { model.reload() } label: { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel("Aggiorna dati operativi")
                }
            }
        }
    }
}

struct TrustView: View {
    @State private var state = "Non verificato"
    @State private var lastCheck: Date?
    @State private var checking = false

    var body: some View {
        NavigationStack {
            List {
                Section("Stato endpoint") {
                    HStack {
                        Label(state, systemImage: state == "Raggiungibile" ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        Spacer()
                        if checking { ProgressView() }
                    }
                    if let lastCheck {
                        Text("Ultimo controllo: \(lastCheck.formatted(date: .abbreviated, time: .shortened))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Button("Verifica adesso") { Task { await checkEndpoint() } }
                        .disabled(checking)
                }

                Section("Privacy operativa") {
                    Label("Sessione web non persistente: cache e storage vengono eliminati alla chiusura del processo.", systemImage: "lock.shield")
                    Label("Nessuna watchlist o copia locale di turni, autisti, giri o mezzi viene creata dalla shell iOS.", systemImage: "externaldrive.badge.xmark")
                    Label("I link esterni escono dal contenitore CAP e vengono aperti dal sistema.", systemImage: "safari")
                }

                Section("Gate commerciale") {
                    Text("Prima di distribuire CAP come prodotto B2B vanno chiusi definitivamente backend/auth, ruoli, audit, backup, support URL, Privacy Policy e gestione lifecycle degli account.")
                }
            }
            .navigationTitle("Trust & Security")
            .task { await checkEndpoint() }
        }
    }

    @MainActor
    private func checkEndpoint() async {
        checking = true
        defer { checking = false }
        var request = URLRequest(url: CAPURLs.base, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12)
        request.httpMethod = "GET"
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, (200..<400).contains(http.statusCode) {
                state = "Raggiungibile"
            } else {
                state = "Risposta non valida"
            }
        } catch {
            state = "Non raggiungibile"
        }
        lastCheck = Date()
    }
}

struct CAPWebContainer: UIViewRepresentable {
    @ObservedObject var model: CAPBrowserModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground

        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        context.coordinator.webView = webView
        context.coordinator.loadIfNeeded()
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastReloadToken != model.reloadToken {
            context.coordinator.lastReloadToken = model.reloadToken
            webView.reload()
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let model: CAPBrowserModel
        weak var webView: WKWebView?
        var lastReloadToken: UUID
        private var didInitialLoad = false

        init(model: CAPBrowserModel) {
            self.model = model
            self.lastReloadToken = model.reloadToken
        }

        func loadIfNeeded() {
            guard !didInitialLoad, let webView else { return }
            didInitialLoad = true
            webView.load(URLRequest(url: CAPURLs.base, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20))
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            model.loadFailed = false
            webView?.reload()
            sender.endRefreshing()
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.isLoading = true
            model.loadFailed = false
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.isLoading = false
            model.loadFailed = false
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(webView) }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(webView) }

        private func fail(_ webView: WKWebView) {
            model.isLoading = false
            model.loadFailed = true
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if ["about", "blob", "data"].contains(url.scheme ?? "") {
                decisionHandler(.allow)
                return
            }

            if let host = url.host, host != CAPURLs.base.host {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }
    }
}
