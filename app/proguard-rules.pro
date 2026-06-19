# Add project specific ProGuard rules here.
# By default, the noise level is set to simple warning/error.

# Keep WebView JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the WebAppInterface class and all its members
-keep class com.example.shieldiptvplayer.WebAppInterface {
    *;
}
