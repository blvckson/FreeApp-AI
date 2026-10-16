package ai.freeapp.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import java.util.Locale;
import android.Manifest;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public class MainActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST = 1001;
    private static final int FILE_CHOOSER_REQUEST = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private TextToSpeech textToSpeech;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = textToSpeech.setLanguage(Locale.US);
                if (result == TextToSpeech.LANG_MISSING_DATA ||
                        result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    textToSpeech.setLanguage(Locale.UK);
                }
            }
        });

        webView = new WebView(this);
        webView.addJavascriptInterface(new NativeNarrator(), "FreeAppNativeVoice");
        webView.addJavascriptInterface(new NativePhoneControl(), "FreeAppNativePhone");

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (request.getResources() == null) {
                        request.deny();
                        return;
                    }
                    boolean audioAllowed =
                            android.os.Build.VERSION.SDK_INT < 23 ||
                            checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                    if (audioAllowed) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        request.deny();
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;

                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception ignored) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return assetLoader.shouldInterceptRequest(Uri.parse(url));
            }
        });

        if (android.os.Build.VERSION.SDK_INT >= 23 &&
                checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    AUDIO_PERMISSION_REQUEST
            );
        }

        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
        setContentView(webView);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST && fileCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) {
                    results = new Uri[]{uri};
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
        }
    }

    private final class NativePhoneControl {
        @JavascriptInterface
        public boolean isSupported() { return android.os.Build.VERSION.SDK_INT >= 24; }

        @JavascriptInterface
        public boolean isEnabled() {
            String enabled = android.provider.Settings.Secure.getString(getContentResolver(),
                    android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            return enabled != null && enabled.toLowerCase(Locale.ROOT).contains(getPackageName().toLowerCase(Locale.ROOT) + "/.phonecontrolservice");
        }

        @JavascriptInterface
        public void openAccessibilitySettings() {
            runOnUiThread(() -> startActivity(new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        }

        @JavascriptInterface
        public void openApp(String app) {
            if (app == null) return;
            String target = app.trim().toLowerCase(Locale.ROOT);
            String packageName;
            if (target.equals("gmail") || target.equals("email")) packageName = "com.google.android.gm";
            else if (target.equals("settings") || target.equals("phone settings")) packageName = "com.android.settings";
            else if (target.equals("chrome") || target.equals("browser")) packageName = "com.android.chrome";
            else if (target.equals("play store") || target.equals("playstore")) packageName = "com.android.vending";
            else if (target.equals("files") || target.equals("file manager")) packageName = "com.google.android.documentsui";
            else { runOnUiThread(() -> android.widget.Toast.makeText(MainActivity.this, "For safety, choose Gmail, Settings, Chrome, Play Store, or Files.", android.widget.Toast.LENGTH_LONG).show()); return; }
            try {
                Intent launch = getPackageManager().getLaunchIntentForPackage(packageName);
                if (launch == null && target.equals("files")) launch = new Intent(Intent.ACTION_GET_CONTENT).setType("*/*");
                if (launch == null) {
                    runOnUiThread(() -> android.widget.Toast.makeText(MainActivity.this, "That app is not installed on this phone.", android.widget.Toast.LENGTH_LONG).show());
                    return;
                }
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(launch);
            } catch (Exception e) {
                runOnUiThread(() -> android.widget.Toast.makeText(MainActivity.this, "Could not open that app.", android.widget.Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void runAction(String action, String value) {
            if (action == null) return;
            String a = action.trim().toLowerCase(Locale.ROOT);
            if (!(a.equals("tap") || a.equals("type") || a.equals("scroll_down") || a.equals("scroll_up") || a.equals("back") || a.equals("home"))) return;
            if (a.equals("type") && value != null) {
                String v = value.toLowerCase(Locale.ROOT);
                if (v.contains("password") || v.contains("passcode") || v.contains("otp") || v.contains("verification code") || v.contains("security code") || v.contains("cvv")) {
                    runOnUiThread(() -> android.widget.Toast.makeText(MainActivity.this, "For your security, enter passwords and verification codes yourself.", android.widget.Toast.LENGTH_LONG).show());
                    return;
                }
            }
            PhoneControlService.queueAction(MainActivity.this, a, value);
        }

        @JavascriptInterface
        public void openSystemUpdates() {
            runOnUiThread(() -> {
                try { startActivity(new Intent("android.settings.SYSTEM_UPDATE_SETTINGS")); }
                catch (Exception ignored) { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); }
            });
        }
    }

    private final class NativeNarrator {
        @JavascriptInterface
        public void speak(String text) {
            if (textToSpeech == null || text == null || text.trim().isEmpty()) return;
            runOnUiThread(() -> {
                textToSpeech.setSpeechRate(1.0f);
                textToSpeech.setPitch(0.98f);
                textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "freeapp-narrator");
            });
        }

        @JavascriptInterface
        public void stop() {
            if (textToSpeech != null) {
                runOnUiThread(() -> textToSpeech.stop());
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        super.onDestroy();
    }
}
