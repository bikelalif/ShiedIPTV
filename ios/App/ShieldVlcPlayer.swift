import Foundation
import UIKit
import AVFoundation
import Capacitor
import VLCKitSPM

/// Capacitor plugin that opens a native, full-screen VLCKit player.
///
/// VLCKit decodes containers/codecs that the iOS HTML5 <video> element cannot
/// (MKV, AVI, AC3/E-AC3/DTS Dolby audio, H.265, ...). Used for movies/series
/// (and live when selected). VLCKit 4 also provides native Picture-in-Picture.
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

/// Full-screen VLC player (VLCKit 4) with tap-to-toggle controls and native PiP.
class VLCPlayerViewController: UIViewController,
                              VLCMediaPlayerDelegate,
                              UIGestureRecognizerDelegate,
                              VLCDrawable,
                              VLCPictureInPictureDrawable,
                              VLCPictureInPictureMediaControlling {

    private let streamURL: URL
    private let titleText: String
    var onClose: (() -> Void)?

    private let mediaPlayer = VLCMediaPlayer()
    private weak var pipController: VLCPictureInPictureWindowControlling?

    private let videoView = UIView()
    private let controlsOverlay = UIView()
    private let topBar = UIView()
    private let bottomBar = UIView()
    private let spinner = UIActivityIndicatorView(style: .large)

    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let playPauseButton = UIButton(type: .system)
    private let pipButton = UIButton(type: .system)
    private let audioButton = UIButton(type: .system)
    private let subtitleButton = UIButton(type: .system)
    private let slider = UISlider()
    private let currentTimeLabel = UILabel()
    private let totalTimeLabel = UILabel()

    private var loadingCheckTimer: Timer?
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

        // Top bar: close + title + PiP
        topBar.translatesAutoresizingMaskIntoConstraints = false
        controlsOverlay.addSubview(topBar)

        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setImage(UIImage(systemName: "chevron.down"), for: .normal)
        closeButton.tintColor = .white
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        topBar.addSubview(closeButton)

        pipButton.translatesAutoresizingMaskIntoConstraints = false
        pipButton.setImage(UIImage(systemName: "pip.enter"), for: .normal)
        pipButton.tintColor = .white
        pipButton.addTarget(self, action: #selector(pipTapped), for: .touchUpInside)
        topBar.addSubview(pipButton)

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

            pipButton.trailingAnchor.constraint(equalTo: topBar.trailingAnchor),
            pipButton.centerYAnchor.constraint(equalTo: topBar.centerYAnchor),
            pipButton.widthAnchor.constraint(equalToConstant: 44),
            pipButton.heightAnchor.constraint(equalToConstant: 44),

            titleLabel.leadingAnchor.constraint(equalTo: closeButton.trailingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(equalTo: pipButton.leadingAnchor, constant: -8),
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
        currentTimeLabel.text = "0:00"
        currentTimeLabel.textColor = .white
        currentTimeLabel.font = .monospacedDigitSystemFont(ofSize: 13, weight: .regular)
        bottomBar.addSubview(currentTimeLabel)

        totalTimeLabel.translatesAutoresizingMaskIntoConstraints = false
        totalTimeLabel.text = "0:00"
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
        // Tap on the always-interactive overlay (alpha stays 1, only the bars fade)
        // so taps are reliably caught even when the bars are hidden.
        controlsOverlay.isUserInteractionEnabled = true
        let tap = UITapGestureRecognizer(target: self, action: #selector(toggleControls))
        tap.delegate = self
        controlsOverlay.addGestureRecognizer(tap)
    }

    // Don't let the toggle gesture swallow taps meant for the buttons.
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        return !(touch.view is UIControl)
    }

    // MARK: - Playback

    private func startPlayback() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            NSLog("[ShieldVlcPlayer] AVAudioSession error: \(error)")
        }

        mediaPlayer.delegate = self
        mediaPlayer.drawable = self   // VLCDrawable + VLCPictureInPictureDrawable -> enables PiP
        let media = VLCMedia(url: streamURL)
        // Larger network cache to avoid the periodic re-buffering / stalls on network streams.
        media?.addOption(":network-caching=3000")
        mediaPlayer.media = media
        mediaPlayer.play()
        scheduleHideControls()

        // Timer to stop spinner once playback starts (especially for live streams where state changes can be flaky)
        loadingCheckTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            if self.mediaPlayer.isPlaying {
                self.spinner.stopAnimating()
                timer.invalidate()
            }
        }
    }

    private func cleanup() {
        hideTimer?.invalidate()
        loadingCheckTimer?.invalidate()
        mediaPlayer.delegate = nil
        mediaPlayer.drawable = nil // Detach drawable to prevent drawing to deallocated view!
        
        let player = mediaPlayer
        DispatchQueue.global(qos: .userInitiated).async {
            player.stop()
        }
    }

    // MARK: - Controls actions

    @objc private func closeTapped() {
        cleanup()
        dismiss(animated: true) { [weak self] in
            self?.onClose?()
        }
    }

    @objc private func pipTapped() {
        pipController?.startPictureInPicture()
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
        let totalMs = mediaLength()
        if totalMs > 0 {
            currentTimeLabel.text = formatTime(Int64(Double(totalMs) * Double(slider.value)))
        }
    }

    @objc private func sliderTouchUp() {
        mediaPlayer.position = Double(slider.value)
        isSeeking = false
        scheduleHideControls()
    }

    @objc private func audioTapped() {
        presentTrackSheet(title: "Piste audio", tracks: mediaPlayer.audioTracks, type: .audio, allowDisable: false)
    }

    @objc private func subtitleTapped() {
        presentTrackSheet(title: "Sous-titres", tracks: mediaPlayer.textTracks, type: .text, allowDisable: true)
    }

    private func presentTrackSheet(title: String, tracks: [VLCMediaPlayer.Track], type: VLCMedia.TrackType, allowDisable: Bool) {
        hideTimer?.invalidate()
        let sheet = UIAlertController(title: title, message: nil, preferredStyle: .actionSheet)

        for (i, track) in tracks.enumerated() {
            let mark = track.isSelected ? "  ✓" : ""
            sheet.addAction(UIAlertAction(title: track.trackName + mark, style: .default) { [weak self] _ in
                self?.mediaPlayer.selectTrack(at: i, type: type)
                self?.scheduleHideControls()
            })
        }
        if allowDisable {
            sheet.addAction(UIAlertAction(title: "Désactiver", style: .default) { [weak self] _ in
                self?.mediaPlayer.deselectAllTextTracks()
                self?.scheduleHideControls()
            })
        }
        sheet.addAction(UIAlertAction(title: "Annuler", style: .cancel) { [weak self] _ in
            self?.scheduleHideControls()
        })
        if let pop = sheet.popoverPresentationController {
            let anchor = (type == .text) ? subtitleButton : audioButton
            pop.sourceView = anchor
            pop.sourceRect = anchor.bounds
        }
        present(sheet, animated: true)
    }

    // MARK: - Controls visibility

    @objc private func toggleControls() {
        controlsVisible ? hideControls() : showControls()
    }

    private func setBarsAlpha(_ alpha: CGFloat) {
        topBar.alpha = alpha
        bottomBar.alpha = alpha
    }

    private func showControls() {
        controlsVisible = true
        UIView.animate(withDuration: 0.2) { self.setBarsAlpha(1) }
        scheduleHideControls()
    }

    private func hideControls() {
        controlsVisible = false
        hideTimer?.invalidate()
        UIView.animate(withDuration: 0.2) { self.setBarsAlpha(0) }
    }

    private func scheduleHideControls() {
        hideTimer?.invalidate()
        hideTimer = Timer.scheduledTimer(withTimeInterval: 4.0, repeats: false) { [weak self] _ in
            guard let self = self, self.mediaPlayer.isPlaying else { return }
            self.hideControls()
        }
    }

    // MARK: - Helpers

    private func formatTime(_ ms: Int64) -> String {
        let totalSeconds = max(0, Int(ms / 1000))
        let h = totalSeconds / 3600
        let m = (totalSeconds % 3600) / 60
        let s = totalSeconds % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }

    // MARK: - VLCMediaPlayerDelegate

    // VLCKit 4 delivers delegate callbacks on a background thread, so every UIKit/state
    // update below must be hopped onto the main queue.
    func mediaPlayerStateChanged(_ newState: VLCMediaPlayerState) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            switch newState {
            case .opening:
                if !self.mediaPlayer.isPlaying { self.spinner.startAnimating() }
            case .playing:
                self.spinner.stopAnimating()
                self.playPauseButton.setImage(UIImage(systemName: "pause.fill"), for: .normal)
            case .paused, .stopped, .stopping:
                self.spinner.stopAnimating()
            case .error:
                self.spinner.stopAnimating()
                self.showError()
            default:
                break
            }
            self.pipController?.invalidatePlaybackState()
        }
    }

    func mediaPlayerTimeChanged(_ aNotification: Notification) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.spinner.stopAnimating()
            if !self.isSeeking {
                self.slider.value = Float(self.mediaPlayer.position)
                self.currentTimeLabel.text = self.formatTime(self.mediaTime())
            }
            let total = self.mediaLength()
            if total > 0 {
                self.totalTimeLabel.text = self.formatTime(total)
            }
        }
    }

    func mediaPlayerLengthChanged(_ length: Int64) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if length > 0 {
                self.totalTimeLabel.text = self.formatTime(length)
            }
            self.pipController?.invalidatePlaybackState()
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

    // MARK: - VLCDrawable

    func addSubview(_ view: UIView) {
        videoView.addSubview(view)
    }

    func bounds() -> CGRect {
        return videoView.bounds
    }

    // MARK: - VLCPictureInPictureDrawable

    func mediaController() -> VLCPictureInPictureMediaControlling {
        return self
    }

    func pictureInPictureReady() -> ((VLCPictureInPictureWindowControlling?) -> Void) {
        return { [weak self] controller in
            self?.pipController = controller
        }
    }

    // MARK: - VLCPictureInPictureMediaControlling

    func play() {
        mediaPlayer.play()
    }

    func pause() {
        mediaPlayer.pause()
    }

    func seek(by offset: Int64, completion: @escaping () -> Void) {
        mediaPlayer.jump(withOffset: Int32(offset), completion: completion)
    }

    func mediaLength() -> Int64 {
        return mediaPlayer.media?.length.value?.int64Value ?? 0
    }

    func mediaTime() -> Int64 {
        return mediaPlayer.time.value?.int64Value ?? 0
    }

    func isMediaSeekable() -> Bool {
        return mediaPlayer.isSeekable
    }

    func isMediaPlaying() -> Bool {
        return mediaPlayer.isPlaying
    }
}
