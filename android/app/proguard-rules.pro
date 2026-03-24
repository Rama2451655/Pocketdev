# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# React Native RNFS
-keep class com.rnfs.** { *; }

# React Native WebView
-keep class com.reactnativecommunity.webview.** { *; }

# Isomorphic Git / LightningFS
-keep class io.pocketdev.** { *; }

# Keep JS interfaces
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
-keepclassmembers class *  { native <methods>; }
-keepclassmembers class ** { @com.facebook.proguard.annotations.DoNotStrip *; }
-keep @com.facebook.proguard.annotations.DoNotStrip class *

# OkHttp (networking)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# General
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
