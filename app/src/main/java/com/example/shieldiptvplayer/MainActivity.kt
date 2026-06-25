package com.example.shieldiptvplayer

import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError
import android.webkit.SslErrorHandler
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.ui.PlayerView
import androidx.media3.ui.AspectRatioFrameLayout

class MainActivity : ComponentActivity() {
    companion object {
        var wasAppInBackground = false
        var isLaunchingPlayerActivity = false
    }

    private lateinit var webView: WebView
    private lateinit var playerView: PlayerView
    private var previewPlayer: ExoPlayer? = null

    private var isFullscreen = false
    private var isControllerVisible = false
    private var previewX = 0f
    private var previewY = 0f
    private var previewWidth = 0f
    private var previewHeight = 0f
    private var currentUrl = ""
    private var retryCount = 0

    private val reconnectRunnable = Runnable {
        if (!isDestroyed && !isFinishing) {
            startPreviewPlayer(currentUrl)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on for video playback
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        // Fullscreen immersive mode
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )

        val rootLayout = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(webView)

        playerView = PlayerView(this).apply {
            layoutParams = FrameLayout.LayoutParams(0, 0)
            useController = false
            controllerAutoShow = false
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            visibility = View.GONE
            setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { visibility ->
                isControllerVisible = (visibility == View.VISIBLE)
            })
        }
        rootLayout.addView(playerView)

        setContentView(rootLayout)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowUniversalAccessFromFileURLs = true
        settings.allowFileAccessFromFileURLs = true
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.mediaPlaybackRequiresUserGesture = false

        // Custom User Agent to trigger isTvWrapper = true.
        // Append a FireTV marker so the web layer can force native ExoPlayer (Fire TV's
        // WebView cannot render HTML5/MSE video, which leaves Live TV without a picture).
        val defaultUserAgent = settings.userAgentString
        val isFireTv = packageManager.hasSystemFeature("amazon.hardware.fire_tv") ||
            android.os.Build.MANUFACTURER.equals("Amazon", ignoreCase = true)
        settings.userAgentString = "$defaultUserAgent; AndroidTV" + if (isFireTv) "; FireTV" else ""

        // Add JavaScript Interface for ExoPlayer integration
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidApp")

        PlayerActivity.onErrorCallback = { errMsg ->
            runOnUiThread {
                val escapedMsg = errMsg.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ")
                webView.evaluateJavascript(
                    "if (typeof testerLog === 'function') { testerLog('ExoPlayer Error: ' + \"$escapedMsg\", 'error'); }" +
                    "else if (typeof log === 'function') { log('ExoPlayer Error: ' + \"$escapedMsg\", 'error'); }", 
                    null
                )
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                webView.evaluateJavascript("document.body.style.overflow = 'hidden';", null)
            }
        }

        webView.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onResume() {
        super.onResume()
        // Re-apply immersive fullscreen flags to ensure TV controls layout matches
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
        if (wasAppInBackground) {
            wasAppInBackground = false
            webView.evaluateJavascript("if (typeof onAndroidAppResumeFromBackground === 'function') { onAndroidAppResumeFromBackground(); }", null)
        } else {
            webView.evaluateJavascript("if (typeof onAndroidResume === 'function') { onAndroidResume(); }", null)
        }
    }

    override fun onStop() {
        super.onStop()
        if (!isLaunchingPlayerActivity) {
            wasAppInBackground = true
        }
        isLaunchingPlayerActivity = false
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (isFullscreen) {
                if (isControllerVisible) {
                    playerView.hideController()
                } else {
                    exitFullscreen()
                }
                return true
            }
            webView.evaluateJavascript("handleBackButton();", null)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    fun startPreview(url: String, x: Float, y: Float, width: Float, height: Float) {
        runOnUiThread {
            try {
                window.decorView.removeCallbacks(reconnectRunnable)
                isFullscreen = false
                
                previewX = x
                previewY = y
                previewWidth = width
                previewHeight = height

                val density = resources.displayMetrics.density
                val params = FrameLayout.LayoutParams(
                    Math.round(width * density),
                    Math.round(height * density)
                ).apply {
                    leftMargin = Math.round(x * density)
                    topMargin = Math.round(y * density)
                }

                playerView.layoutParams = params
                playerView.useController = false
                playerView.visibility = View.VISIBLE
                
                retryCount = 0
                startPreviewPlayer(url)
                
                android.util.Log.d("MainActivity", "Native preview started at x=$x, y=$y, w=$width, h=$height with URL: $url")
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Failed to start native preview: ${e.message}", e)
            }
        }
    }

    private fun startPreviewPlayer(url: String) {
        releasePreviewPlayer()
        currentUrl = url

        val renderersFactory = DefaultRenderersFactory(this).apply {
            setEnableDecoderFallback(true)
        }
        
        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(20000)
            .setAllowCrossProtocolRedirects(true)
            .setKeepPostFor302Redirects(true)

        val loadErrorHandlingPolicy = DefaultLoadErrorHandlingPolicy(6)

        val mediaSourceFactory = DefaultMediaSourceFactory(httpDataSourceFactory)
            .setLoadErrorHandlingPolicy(loadErrorHandlingPolicy)

        // Buffer durations tuned to maximize buffering and prevent stuttering on live streams and VODs.
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                50000, // Min buffer (50s)
                120000, // Max buffer (120s)
                5000,  // Buffer for playback (5s)
                10000   // Buffer for resume (10s)
            )
            .setBackBuffer(60000, true)
            .build()

        val newPlayer = ExoPlayer.Builder(this, renderersFactory)
            .setMediaSourceFactory(mediaSourceFactory)
            .setLoadControl(loadControl)
            .build().apply {
                // Build media item with 30 seconds target live offset to allow deep buffering
                val mediaItem = MediaItem.Builder()
                    .setUri(url)
                    .setLiveConfiguration(
                        MediaItem.LiveConfiguration.Builder()
                            .setTargetOffsetMs(30000)
                            .build()
                    )
                    .build()
                setMediaItem(mediaItem)
                prepare()
                playWhenReady = true
            }
        previewPlayer = newPlayer
        playerView.player = newPlayer

        newPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    retryCount = 0
                } else if (playbackState == Player.STATE_ENDED) {
                    android.util.Log.e("MainActivity", "Stream ended unexpectedly. Reconnecting...")
                    retryCount++
                    val delay = (2000L * retryCount).coerceIn(2000L, 10000L)
                    window.decorView.postDelayed(reconnectRunnable, delay)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                val msg = error.message ?: "Unknown error"
                android.util.Log.e("MainActivity", "Playback error: $msg", error)
                retryCount++
                val delay = (2000L * retryCount).coerceIn(2000L, 10000L)
                window.decorView.postDelayed(reconnectRunnable, delay)
            }
        })
    }

    fun stopPreview() {
        runOnUiThread {
            try {
                window.decorView.removeCallbacks(reconnectRunnable)
                playerView.visibility = View.GONE
                playerView.player = null
                releasePreviewPlayer()
                isFullscreen = false
                android.util.Log.d("MainActivity", "Native preview stopped")
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Failed to stop native preview: ${e.message}", e)
            }
        }
    }

    fun updatePreviewPosition(x: Float, y: Float, width: Float, height: Float) {
        runOnUiThread {
            try {
                if (isFullscreen) {
                    return@runOnUiThread
                }
                
                previewX = x
                previewY = y
                previewWidth = width
                previewHeight = height
                
                val density = resources.displayMetrics.density
                val params = FrameLayout.LayoutParams(
                    Math.round(width * density),
                    Math.round(height * density)
                ).apply {
                    leftMargin = Math.round(x * density)
                    topMargin = Math.round(y * density)
                }
                playerView.layoutParams = params
                android.util.Log.d("MainActivity", "Native preview position updated to x=$x, y=$y, w=$width, h=$height")
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Failed to update native preview position: ${e.message}", e)
            }
        }
    }

    fun goFullscreen() {
        runOnUiThread {
            try {
                isFullscreen = true
                
                val params = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                playerView.layoutParams = params
                playerView.useController = true
                playerView.showController()
                
                playerView.isFocusable = true
                playerView.isFocusableInTouchMode = true
                playerView.requestFocus()
                
                android.util.Log.d("MainActivity", "Native player resized to fullscreen")
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Failed to go fullscreen: ${e.message}", e)
            }
        }
    }

    fun exitFullscreen() {
        runOnUiThread {
            try {
                isFullscreen = false
                
                playerView.useController = false
                playerView.hideController()
                
                val density = resources.displayMetrics.density
                val params = FrameLayout.LayoutParams(
                    Math.round(previewWidth * density),
                    Math.round(previewHeight * density)
                ).apply {
                    leftMargin = Math.round(previewX * density)
                    topMargin = Math.round(previewY * density)
                }
                playerView.layoutParams = params
                
                playerView.isFocusable = false
                webView.requestFocus()
                
                webView.evaluateJavascript("if (typeof onAndroidExitFullscreen === 'function') { onAndroidExitFullscreen(); }", null)
                
                android.util.Log.d("MainActivity", "Native player resized back to preview coordinates")
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Failed to exit fullscreen: ${e.message}", e)
            }
        }
    }

    private fun releasePreviewPlayer() {
        previewPlayer?.let {
            it.release()
            previewPlayer = null
        }
    }

    override fun onPause() {
        super.onPause()
        window.decorView.removeCallbacks(reconnectRunnable)
        runOnUiThread {
            playerView.visibility = View.GONE
            playerView.player = null
        }
        releasePreviewPlayer()
    }

    override fun onDestroy() {
        super.onDestroy()
        window.decorView.removeCallbacks(reconnectRunnable)
        releasePreviewPlayer()
    }
}

class WebAppInterface(private val activity: MainActivity) {
    @android.webkit.JavascriptInterface
    fun playStream(url: String, title: String, logoUrl: String) {
        MainActivity.isLaunchingPlayerActivity = true
        val intent = android.content.Intent(activity, PlayerActivity::class.java).apply {
            putExtra("STREAM_URL", url)
            putExtra("STREAM_TITLE", title)
            putExtra("LOGO_URL", logoUrl)
        }
        activity.startActivity(intent)
    }

    @android.webkit.JavascriptInterface
    fun openExternalPlayer(url: String) {
        activity.runOnUiThread {
            try {
                MainActivity.isLaunchingPlayerActivity = true
                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                    setDataAndType(android.net.Uri.parse(url), "video/*")
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                android.widget.Toast.makeText(activity, "No video player (like VLC) found.", android.widget.Toast.LENGTH_LONG).show()
            }
        }
    }

    @android.webkit.JavascriptInterface
    fun openVlcPlayer(url: String) {
        activity.runOnUiThread {
            try {
                MainActivity.isLaunchingPlayerActivity = true
                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                    setDataAndType(android.net.Uri.parse(url), "video/*")
                    setPackage("org.videolan.vlc")
                    component = android.content.ComponentName("org.videolan.vlc", "org.videolan.vlc.gui.video.VideoPlayerActivity")
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                android.widget.Toast.makeText(activity, "VLC Player non installé. Lancement du lecteur par défaut...", android.widget.Toast.LENGTH_LONG).show()
                try {
                    val fallbackIntent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                        setDataAndType(android.net.Uri.parse(url), "video/*")
                    }
                    activity.startActivity(fallbackIntent)
                } catch (ex: Exception) {
                    android.widget.Toast.makeText(activity, "Aucun lecteur vidéo trouvé.", android.widget.Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    @android.webkit.JavascriptInterface
    fun startPreview(url: String, x: Double, y: Double, width: Double, height: Double) {
        activity.startPreview(url, x.toFloat(), y.toFloat(), width.toFloat(), height.toFloat())
    }

    @android.webkit.JavascriptInterface
    fun stopPreview() {
        activity.stopPreview()
    }

    @android.webkit.JavascriptInterface
    fun updatePreviewPosition(x: Double, y: Double, width: Double, height: Double) {
        activity.updatePreviewPosition(x.toFloat(), y.toFloat(), width.toFloat(), height.toFloat())
    }

    @android.webkit.JavascriptInterface
    fun goFullscreen() {
        activity.goFullscreen()
    }

    @android.webkit.JavascriptInterface
    fun exitFullscreen() {
        activity.exitFullscreen()
    }
}
