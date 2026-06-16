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
            keepScreenOn = true
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
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

        player = ExoPlayer.Builder(this, renderersFactory).build().apply {
            playerView.player = this
            
            val mediaItem = MediaItem.fromUri(url)
            setMediaItem(mediaItem)
            prepare()
            playWhenReady = true
            
            addListener(object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    super.onPlayerError(error)
                    val msg = error.message ?: "Unknown error"
                    android.util.Log.e("PlayerActivity", "Playback error: $msg", error)
                    
                    if (retryCount < 1) {
                        retryCount++
                        Toast.makeText(this@PlayerActivity, "Reconnexion...", Toast.LENGTH_SHORT).show()
                        releasePlayer()
                        window.decorView.postDelayed({
                            initializePlayer(streamUrl)
                        }, 1500)
                    } else {
                        onErrorCallback?.invoke(msg)
                        Toast.makeText(this@PlayerActivity, "Erreur de lecture: $msg", Toast.LENGTH_LONG).show()
                        finish()
                    }
                }
            })
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            finish()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onPause() {
        super.onPause()
        player?.playWhenReady = false
    }

    override fun onStop() {
        super.onStop()
        releasePlayer()
    }

    override fun onDestroy() {
        super.onDestroy()
        releasePlayer()
    }

    private fun releasePlayer() {
        player?.let {
            it.release()
            player = null
        }
    }
}
