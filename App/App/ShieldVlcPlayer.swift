import Foundation
import UIKit
import AVFoundation
import Capacitor
import VLCKitSPM

/// Capacitor plugin that opens a native, full-screen VLCKit player.
///
/// VLCKit decodes containers/codecs that the iOS HTML5 <video> element cannot
/// (MKV, AVI, AC3/E-AC3/DTS Dolby audio, H.265, ...), so it is used for movies
/// and series. Live channels keep using the native HLS player in the WebView.
@objc(ShieldVlcPlayer)
public class ShieldVlcPlayer: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShieldVlcPlayer"
    public let jsName = "ShieldVlcPlayer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var playerVC: VLCPlayerViewController?

    @objc func play(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid 'url'")
            return
        }
        let title = call.getString("title") ?? ""
        // Resolve the promise only when the player is closed by the user.
        call.keepAlive = true

        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("No view controller available to present the player")
                return
            }
            let vc = VLCPlayerViewController(url: url, title: title)
            vc.modalPresentationStyle = .fullScreen
            vc.modalTransitionStyle = .crossDissolve
            vc.onClose = { [weak self] in
                self?.playerVC = nil
                call.resolve(["closed": true])
            }
            self.playerVC = vc
            presenter.present(vc, animated: true, completion: nil)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let vc = self.playerVC {
                vc.dismiss(animated: true) { call.resolve() }
                self.playerVC = nil
            } else {
                call.resolve()
            }
        }
    }
}

/// Full-screen VLC player with a tap-to-toggle controls overlay.
class VLCPlayerViewController: UIViewController, VLCMediaPlayerDelegate {

    private let streamURL: URL
    private let titleText: String
    var onClose: (() -> Void)?

    private let mediaPlayer = VLCMediaPlayer()

    private let videoView = UIView()
    private let controlsOverlay = UIView()
    private let topBar = UIView()
    private let bottomBar = UIView()
    private let spinner = UIActivityIndicatorView(style: .large)

    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let playPauseButton = UIButton(type: .system)
    private let audioButton = UIButton(type: .system)
    private let subtitleButton = UIButton(type: .system)
    private let slider = UISlider()
    private let currentTimeLabel = UILabel()
    private let totalTimeLabel = UILabel()

    private var isSeeking = false
    private var controlsVisible = true
    private var hideTimer: Timer?

    init(url: URL, title: String) {
        self.streamURL = url
        self.titleText = title
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupVideoView()
        setupControls()
        setupGestures()
        startPlayback()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        UIApplication.shared.isIdleTimerDisabled = true
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        UIApplication.shared.isIdleTimerDisabled = false
    }

    override var prefersStatusBarHidden: Bool { return true }

    // MARK: - Setup

    private func setupVideoView() {
        videoView.translatesAutoresizingMaskIntoConstraints = false
        videoView.backgroundColor = .black
        view.addSubview(videoView)
        NSLayoutConstraint.activate([
            videoView.topAnchor.constraint(equalTo: view.topAnchor),
            videoView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            videoView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            videoView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.color = .white
        spinner.hidesWhenStopped = true
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        spinner.startAnimating()
    }

    private func setupControls() {
        controlsOverlay.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(controlsOverlay)
        NSLayoutConstraint.activate([
            controlsOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            controlsOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            controlsOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            controlsOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        let guide = view.safeAreaLayoutGuide

        // Top bar: close + title
        topBar.translatesAutoresizingMaskIntoConstraints = false
        controlsOverlay.addSubview(topBar)

        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setImage(UIImage(systemName: "chevron.down"), for: .normal)
        closeButton.tintColor = .white
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        topBar.addSubview(closeButton)

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = titleText
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        titleLabel.lineBreakMode = .byTruncatingTail
        topBar.addSubview(titleLabel)

        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: guide.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            topBar.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            topBar.heightAnchor.constraint(equalToConstant: 48),

            closeButton.leadingAnchor.constraint(equalTo: topBar.leadingAnchor),
            closeButton.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),

            titleLabel.leadingAnchor.constraint(equalTo: closeButton.trailingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -8),
            titleLabel.centerYAnchor.constraint(equalTo: topBar.centerYAnchor)
        ])

        // Bottom bar: play/pause, time, slider, audio, subtitles
        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        controlsOverlay.addSubview(bottomBar)

        playPauseButton.translatesAutoresizingMaskIntoConstraints = false
        playPauseButton.setImage(UIImage(systemName: "pause.fill"), for: .normal)
        playPauseButton.tintColor = .white
        playPauseButton.addTarget(self, action: #selector(togglePlayPause), for: .touchUpInside)
        bottomBar.addSubview(playPauseButton)

        currentTimeLabel.translatesAutoresizingMaskIntoConstraints = false
        currentTimeLabel.text = "00:00"
        currentTimeLabel.textColor = .white
        currentTimeLabel.font = .monospacedDigitSystemFont(ofSize: 13, weight: .regular)
        bottomBar.addSubview(currentTimeLabel)

        totalTimeLabel.translatesAutoresizingMaskIntoConstraints = false
        totalTimeLabel.text = "00:00"
        totalTimeLabel.textColor = .white
        totalTimeLabel.font = .monospacedDigitSystemFont(ofSize: 13, weight: .regular)
        bottomBar.addSubview(totalTimeLabel)

        slider.translatesAutoresizingMaskIntoConstraints = false
        slider.minimumValue = 0
        slider.maximumValue = 1
        slider.value = 0
        slider.minimumTrackTintColor = .systemRed
        slider.addTarget(self, action: #selector(sliderTouchDown), for: .touchDown)
        slider.addTarget(self, action: #selector(sliderValueChanged), for: .valueChanged)
        slider.addTarget(self, action: #selector(sliderTouchUp), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        bottomBar.addSubview(slider)

        audioButton.translatesAutoresizingMaskIntoConstraints = false
        audioButton.setImage(UIImage(systemName: "waveform"), for: .normal)
        audioButton.tintColor = .white
        audioButton.addTarget(self, action: #selector(audioTapped), for: .touchUpInside)
        bottomBar.addSubview(audioButton)

        subtitleButton.translatesAutoresizingMaskIntoConstraints = false
        subtitleButton.setImage(UIImage(systemName: "captions.bubble"), for: .normal)
        subtitleButton.tintColor = .white
        subtitleButton.addTarget(self, action: #selector(subtitleTapped), for: .touchUpInside)
        bottomBar.addSubview(subtitleButton)

        NSLayoutConstraint.activate([
            bottomBar.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            bottomBar.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            bottomBar.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -8),
            bottomBar.heightAnchor.constraint(equalToConstant: 44),

            playPauseButton.leadingAnchor.constraint(equalTo: bottomBar.leadingAnchor),
            playPauseButton.centerYAnchor.constraint(equalTo: bottomBar.centerYAnchor),
            playPauseButton.widthAnchor.constraint(equalToConstant: 44),
            playPauseButton.heightAnchor.constraint(equalToConstant: 44),

            currentTimeLabel.leadingAnchor.constraint(equalTo: playPauseButton.trailingAnchor, constant: 8),
            currentTimeLabel.centerYAnchor.constraint(equalTo: bottomBar.centerYAnchor),

            subtitleButton.trailingAnchor.constraint(equalTo: bottomBar.trailingAnchor),
            subtitleButton.centerYAnchor.constraint(equalTo: bottomBar.centerYAnchor),
            subtitleButton.widthAnchor.constraint(equalToConstant: 44),
            subtitleButton.heightAnchor.constraint(equalToConstant: 44),

            audioButton.trailingAnchor.constraint(equalTo: subtitleButton.leadingAnchor, constant: -4),
            audioButton.centerYAnchor.constraint(equalTo: bottomBar.centerYAnchor),
            audioButton.widthAnchor.constraint(equalToConstant: 44),
            audioButton.heightAnchor.constraint(equalToConstant: 44),

            totalTimeLabel.trailingAnchor.constraint(equalTo: audioButton.leadingAnchor, constant: -8),
            totalTimeLabel.centerYAnchor.constraint(equalTo: bottomBar.centerYAnchor),

            slider.leadingAnchor.constraint(equalTo: currentTimeLabel.trailingAnchor, constant: 10),
            slider.trailingAnchor.constraint(equalTo: totalTimeLabel.leadingAnchor, constant: -10),
            slider.centerYAnchor.constraint(equalTo: bottomBar.centerYAnchor)
        ])

        addGradient(to: topBar, top: true)
        addGradient(to: bottomBar, top: false)
    }

    private func addGradient(to bar: UIView, top: Bool) {
        let gradient = CAGradientLayer()
        let dark = UIColor.black.withAlphaComponent(0.6).cgColor
        let clear = UIColor.clear.cgColor
        gradient.colors = top ? [dark, clear] : [clear, dark]
        gradient.frame = CGRect(x: -12, y: top ? -20 : -10, width: UIScreen.main.bounds.width, height: 80)
        bar.layer.insertSublayer(gradient, at: 0)
    }

    private func setupGestures() {
        let tap = UITapGestureRecognizer(target: self, action: #selector(toggleControls))
        view.addGestureRecognizer(tap)
    }

    // MARK: - Playback

    private func startPlayback() {
        // Use the playback category so audio is heard even with the mute switch on.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            NSLog("[ShieldVlcPlayer] AVAudioSession error: \(error)")
        }

        let media = VLCMedia(url: streamURL)
        mediaPlayer.media = media
        mediaPlayer.drawable = videoView
        mediaPlayer.delegate = self
        mediaPlayer.play()
        scheduleHideControls()
    }

    private func cleanup() {
        hideTimer?.invalidate()
        mediaPlayer.stop()
        mediaPlayer.delegate = nil
    }

    // MARK: - Controls actions

    @objc private func closeTapped() {
        cleanup()
        dismiss(animated: true) { [weak self] in
            self?.onClose?()
        }
    }

    @objc private func togglePlayPause() {
        if mediaPlayer.isPlaying {
            mediaPlayer.pause()
            playPauseButton.setImage(UIImage(systemName: "play.fill"), for: .normal)
        } else {
            mediaPlayer.play()
            playPauseButton.setImage(UIImage(systemName: "pause.fill"), for: .normal)
        }
        scheduleHideControls()
    }

    @objc private func sliderTouchDown() {
        isSeeking = true
        hideTimer?.invalidate()
    }

    @objc private func sliderValueChanged() {
        let totalMs = Double(mediaPlayer.media?.length.intValue ?? 0)
        if totalMs > 0 {
            let previewMs = Int32(totalMs * Double(slider.value))
            currentTimeLabel.text = VLCTime(int: previewMs).stringValue
        }
    }

    @objc private func sliderTouchUp() {
        mediaPlayer.position = slider.value
        isSeeking = false
        scheduleHideControls()
    }

    @objc private func audioTapped() {
        presentTrackSheet(
            title: "Piste audio",
            names: mediaPlayer.audioTrackNames as? [String] ?? [],
            indexes: mediaPlayer.audioTrackIndexes as? [NSNumber] ?? [],
            current: mediaPlayer.currentAudioTrackIndex
        ) { [weak self] index in
            self?.mediaPlayer.currentAudioTrackIndex = index
        }
    }

    @objc private func subtitleTapped() {
        presentTrackSheet(
            title: "Sous-titres",
            names: mediaPlayer.videoSubTitlesNames as? [String] ?? [],
            indexes: mediaPlayer.videoSubTitlesIndexes as? [NSNumber] ?? [],
            current: mediaPlayer.currentVideoSubTitleIndex
        ) { [weak self] index in
            self?.mediaPlayer.currentVideoSubTitleIndex = index
        }
    }

    private func presentTrackSheet(title: String, names: [String], indexes: [NSNumber], current: Int32, onSelect: @escaping (Int32) -> Void) {
        hideTimer?.invalidate()
        let sheet = UIAlertController(title: title, message: nil, preferredStyle: .actionSheet)
        for (i, name) in names.enumerated() where i < indexes.count {
            let idx = indexes[i].int32Value
            let mark = (idx == current) ? "  ✓" : ""
            sheet.addAction(UIAlertAction(title: name + mark, style: .default) { _ in
                onSelect(idx)
                self.scheduleHideControls()
            })
        }
        sheet.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in
            self.scheduleHideControls()
        })
        if let pop = sheet.popoverPresentationController {
            pop.sourceView = title == "Sous-titres" ? subtitleButton : audioButton
            pop.sourceRect = (title == "Sous-titres" ? subtitleButton : audioButton).bounds
        }
        present(sheet, animated: true)
    }

    // MARK: - Controls visibility

    @objc private func toggleControls() {
        controlsVisible ? hideControls() : showControls()
    }

    private func showControls() {
        controlsVisible = true
        UIView.animate(withDuration: 0.2) { self.controlsOverlay.alpha = 1 }
        scheduleHideControls()
    }

    private func hideControls() {
        controlsVisible = false
        hideTimer?.invalidate()
        UIView.animate(withDuration: 0.2) { self.controlsOverlay.alpha = 0 }
    }

    private func scheduleHideControls() {
        hideTimer?.invalidate()
        hideTimer = Timer.scheduledTimer(withTimeInterval: 4.0, repeats: false) { [weak self] _ in
            guard let self = self, self.mediaPlayer.isPlaying else { return }
            self.hideControls()
        }
    }

    // MARK: - VLCMediaPlayerDelegate

    func mediaPlayerStateChanged(_ aNotification: Notification) {
        switch mediaPlayer.state {
        case .buffering, .opening:
            if !mediaPlayer.isPlaying { spinner.startAnimating() }
        case .playing:
            spinner.stopAnimating()
            playPauseButton.setImage(UIImage(systemName: "pause.fill"), for: .normal)
        case .paused, .stopped:
            spinner.stopAnimating()
        case .ended:
            closeTapped()
        case .error:
            spinner.stopAnimating()
            showError()
        default:
            break
        }
    }

    func mediaPlayerTimeChanged(_ aNotification: Notification) {
        spinner.stopAnimating()
        if !isSeeking {
            slider.value = mediaPlayer.position
            currentTimeLabel.text = mediaPlayer.time.stringValue
        }
        if let length = mediaPlayer.media?.length, length.intValue > 0 {
            totalTimeLabel.text = length.stringValue
        }
    }

    private func showError() {
        let alert = UIAlertController(title: "Erreur de lecture",
                                      message: "Impossible de lire ce flux.",
                                      preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.closeTapped()
        })
        present(alert, animated: true)
    }
}
