package com.example.shieldiptvplayer

import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
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

class PlayerActivity : ComponentActivity() {
    companion object {
        var onErrorCallback: ((String) -> Unit)? = null
    }

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView
    private var retryCount = 0
    private var streamUrl = ""
    private var isControllerVisible = false
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private val hideControllerRunnable = Runnable {
        playerView.hideController()
    }

    private fun resetHideControllerTimer() {
        handler.removeCallbacks(hideControllerRunnable)
        handler.postDelayed(hideControllerRunnable, 3000) // Auto-hide after 3 seconds of inactivity
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable edge-to-edge layout & hide system bars for immersive fullscreen
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }

        // Programmatic container layout matching parents
        val container = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        playerView = PlayerView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            useController = true
            controllerAutoShow = false
            keepScreenOn = true
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT

            setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { visibility ->
                isControllerVisible = (visibility == View.VISIBLE)
                if (isControllerVisible) {
                    resetHideControllerTimer()
                } else {
                    handler.removeCallbacks(hideControllerRunnable)
                }
            })
        }
        container.addView(playerView)

        setContentView(container)

        streamUrl = intent.getStringExtra("STREAM_URL") ?: ""
        initializePlayer(streamUrl)
    }

    private fun initializePlayer(url: String) {
        if (url.isEmpty()) {
            finish()
            return
        }

        val renderersFactory = DefaultRenderersFactory(this).apply {
            setEnableDecoderFallback(true)
        }
        
        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(20000)
            .setAllowCrossProtocolRedirects(true)
            .setKeepPostFor302Redirects(true)

        // Retry transient network/segment errors several times before surfacing a fatal error.
        // For live HLS this keeps playback alive when a single segment request fails.
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
            .setBackBuffer(60000, true) // Keep last 60s of played media in memory
            .build()

        player = ExoPlayer.Builder(this, renderersFactory)
            .setMediaSourceFactory(mediaSourceFactory)
            .setLoadControl(loadControl)
            .build().apply {
            playerView.player = this
            
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
            
            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        // Reset retry count when stream successfully plays
                        retryCount = 0
                    } else if (playbackState == Player.STATE_ENDED) {
                        android.util.Log.e("PlayerActivity", "Stream ended unexpectedly. Reconnecting...")
                        Toast.makeText(this@PlayerActivity, "Reconnexion (Fin de flux)...", Toast.LENGTH_SHORT).show()
                        retryCount++
                        releasePlayer()
                        window.decorView.postDelayed({
                            initializePlayer(streamUrl)
                        }, reconnectDelayMs())
                    }
                }

                override fun onPlayerError(error: PlaybackException) {
                    super.onPlayerError(error)
                    val msg = error.message ?: "Unknown error"
                    android.util.Log.e("PlayerActivity", "Playback error: $msg", error)
                    
                    retryCount++
                    Toast.makeText(this@PlayerActivity, "Reconnexion ($retryCount)...", Toast.LENGTH_SHORT).show()
                    releasePlayer()
                    window.decorView.postDelayed({
                        initializePlayer(streamUrl)
                    }, reconnectDelayMs())
                }
            })
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (isControllerVisible) {
                playerView.hideController()
                return true
            }
            finish()
            return true
        }

        // For D-pad and media keys, reset timer or show controller if hidden
        if (isControllerVisible) {
            resetHideControllerTimer()
        } else {
            // Show controller if any other key is pressed
            if (keyCode != KeyEvent.KEYCODE_BACK) {
                playerView.showController()
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(hideControllerRunnable)
        player?.playWhenReady = false
    }

    override fun onStop() {
        super.onStop()
        if (!isFinishing) {
            MainActivity.wasAppInBackground = true
            finish()
        } else {
            releasePlayer()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        releasePlayer()
    }

    // Progressive backoff between reconnect attempts (capped at 10s) so a flaky
    // server isn't hammered with a reconnect every 2 seconds, which can make cuts worse.
    private fun reconnectDelayMs(): Long {
        return (2000L * retryCount).coerceIn(2000L, 10000L)
    }

    private fun releasePlayer() {
        player?.let {
            it.release()
            player = null
        }
    }
}
