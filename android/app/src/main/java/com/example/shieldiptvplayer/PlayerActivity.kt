package com.example.shieldiptvplayer

import android.os.Bundle
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

class PlayerActivity : ComponentActivity() {
    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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
        }
        container.addView(playerView)

        // Custom Back Button Overlay (Top-Left)
        val backButton = android.widget.Button(this).apply {
            val sizeWidth = (140 * resources.displayMetrics.density).toInt()
            val sizeHeight = (50 * resources.displayMetrics.density).toInt()
            layoutParams = FrameLayout.LayoutParams(sizeWidth, sizeHeight).apply {
                gravity = android.view.Gravity.TOP or android.view.Gravity.START
                leftMargin = (24 * resources.displayMetrics.density).toInt()
                topMargin = (24 * resources.displayMetrics.density).toInt()
            }
            text = "← Retour"
            textSize = 15f
            setTextColor(android.graphics.Color.WHITE)
            // Draw a rounded-corner semi-transparent background programmatically
            val shape = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                cornerRadius = 25f * resources.displayMetrics.density
                setColor(android.graphics.Color.parseColor("#99000000")) // 60% transparent black
                setStroke((1.5 * resources.displayMetrics.density).toInt(), android.graphics.Color.parseColor("#40FFFFFF"))
            }
            background = shape
            isFocusable = true
            
            // Highlight when focused (TV style)
            setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    shape.setColor(android.graphics.Color.parseColor("#00E5FF")) // Focus border color cyan
                    setTextColor(android.graphics.Color.BLACK)
                    shape.setStroke((1.5 * resources.displayMetrics.density).toInt(), android.graphics.Color.WHITE)
                } else {
                    shape.setColor(android.graphics.Color.parseColor("#99000000"))
                    setTextColor(android.graphics.Color.WHITE)
                    shape.setStroke((1.5 * resources.displayMetrics.density).toInt(), android.graphics.Color.parseColor("#40FFFFFF"))
                }
            }
            
            setOnClickListener {
                finish()
            }
        }
        container.addView(backButton)

        setContentView(container)

        val streamUrl = intent.getStringExtra("STREAM_URL") ?: ""
        initializePlayer(streamUrl)
    }

    private fun initializePlayer(url: String) {
        if (url.isEmpty()) {
            finish()
            return
        }

        player = ExoPlayer.Builder(this).build().apply {
            playerView.player = this
            
            val mediaItem = MediaItem.fromUri(url)
            setMediaItem(mediaItem)
            prepare()
            playWhenReady = true
            
            addListener(object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    super.onPlayerError(error)
                    // Auto-finish player and return to webview when playback fails
                    finish()
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
