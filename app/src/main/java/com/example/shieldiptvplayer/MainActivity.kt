package com.example.shieldiptvplayer

import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError
import android.webkit.SslErrorHandler
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    companion object {
        var wasAppInBackground = false
        var isLaunchingPlayerActivity = false
    }

    private lateinit var webView: WebView

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

        webView = WebView(this)
        setContentView(webView)

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
}
