plugins {
  alias(libs.plugins.android.application)
}

android {
    namespace = "com.example.shieldiptvplayer"
    compileSdk = 35

    signingConfigs {
        create("release") {
            storeFile = file("shield-upload-key.jks")
            storePassword = "shield123"
            keyAlias = "shield-key-alias"
            keyPassword = "shield123"
        }
    }

    defaultConfig {
        applicationId = "com.shieldiptv.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
      compose = false
      aidl = false
      buildConfig = false
      shaders = false
    }

    packaging {
      resources {
        excludes += "/META-INF/{AL2.0,LGPL2.1}"
      }
    }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.activity:activity:1.9.0")
  
  // Google Jetpack Media3 ExoPlayer dependencies for native stream playback
  implementation("androidx.media3:media3-exoplayer:1.3.1")
  implementation("androidx.media3:media3-exoplayer-hls:1.3.1")
  implementation("androidx.media3:media3-ui:1.3.1")
}
