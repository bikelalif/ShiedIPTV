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
import androidx.media3.exoplayer.ExoPlayer
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
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            visibility = View.GONE
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
            webView.evaluateJavascript("handleBackButton();", null)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    fun startPreview(url: String, x: Float, y: Float, width: Float, height: Float) {
        runOnUiThread {
            try {
                releasePreviewPlayer()

                val newPlayer = ExoPlayer.Builder(this).build().apply {
                    setMediaItem(MediaItem.fromUri(url))
                    prepare()
                    playWhenReady = true
                }
                previewPlayer = newPlayer

                val density = resources.displayMetrics.density
                val params = FrameLayout.LayoutParams(
                    Math.round(width * density),
                    Math.round(height * density)
                ).apply {
                    leftMargin = Math.round(x * density)
                    topMargin = Math.round(y * density)
                }

                playerView.layoutParams = params
                playerView.player = newPlayer
                playerView.visibility = View.VISIBLE
                
                android.util.Log.d("MainActivity", "Native preview started at x=$x, y=$y, w=$width, h=$height with URL: $url")
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Failed to start native preview: ${e.message}", e)
            }
        }
    }

    fun stopPreview() {
        runOnUiThread {
            try {
                playerView.visibility = View.GONE
                playerView.player = null
                releasePreviewPlayer()
                android.util.Log.d("MainActivity", "Native preview stopped")
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Failed to stop native preview: ${e.message}", e)
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
        runOnUiThread {
            playerView.visibility = View.GONE
            playerView.player = null
        }
        releasePreviewPlayer()
    }

    override fun onDestroy() {
        super.onDestroy()
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
    fun startPreview(url: String, x: Float, y: Float, width: Float, height: Float) {
        activity.startPreview(url, x, y, width, height)
    }

    @android.webkit.JavascriptInterface
    fun stopPreview() {
        activity.stopPreview()
    }
}
