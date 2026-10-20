package com.cineverse.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String PREFS = "cineverse";
    private static final String KEY_URL = "server_url";

    private WebView webView;
    private FrameLayout rootLayout;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout fullscreenContainer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setBackgroundDrawableResource(android.R.color.black);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.setStatusBarColor(Color.parseColor("#08090D"));
            window.setNavigationBarColor(Color.parseColor("#08090D"));
        }

        rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.parseColor("#08090D"));
        setContentView(rootLayout);

        ensureWebView();
        loadOrAskUrl(null);
    }

    private void ensureWebView() {
        if (webView != null) return;
        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setAllowFileAccess(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setAllowFileAccessFromFileURLs(false);
            s.setAllowUniversalAccessFromFileURLs(false);
        }
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setBackgroundColor(Color.parseColor("#08090D"));
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;
                Uri uri = Uri.parse(url);
                String host = uri.getHost();
                String appHost = Uri.parse(getServerUrl()).getHost();
                if (url.startsWith("http") && host != null && appHost != null && host.equals(appHost)) {
                    return false; // keep inside
                }
                if (url.startsWith("http")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "برنامه‌ای برای باز کردن این پیوند نیست", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(
                        "document.documentElement.setAttribute('data-native','1');", null);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                fullscreenContainer = new FrameLayout(MainActivity.this);
                fullscreenContainer.setBackgroundColor(Color.BLACK);
                fullscreenContainer.addView(view, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                rootLayout.addView(fullscreenContainer, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            }

            @Override
            public void onHideCustomView() {
                if (fullscreenContainer != null) {
                    rootLayout.removeView(fullscreenContainer);
                    fullscreenContainer = null;
                }
                if (customView != null) {
                    customView = null;
                }
                if (customViewCallback != null) {
                    customViewCallback.onCustomViewHidden();
                    customViewCallback = null;
                }
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent,
                                        String contentDisposition, String mimeType, long contentLength) {
                try {
                    String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) req.addRequestHeader("Cookie", cookie);
                    req.addRequestHeader("User-Agent", userAgent);
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    req.setMimeType(mimeType);
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    dm.enqueue(req);
                    Toast.makeText(MainActivity.this, "دانلود شروع شد: " + name, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "دانلود ممکن نشد", Toast.LENGTH_SHORT).show();
                }
            }
        });

        webView.addJavascriptInterface(new NativeBridge(), "CineVerseNative");
        rootLayout.addView(webView);
    }

    private String getServerUrl() {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        return p.getString(KEY_URL, "");
    }

    private void loadOrAskUrl(String preset) {
        String url = preset != null ? preset : getServerUrl();
        if (url == null || url.trim().isEmpty()) {
            askForUrl("");
            return;
        }
        webView.loadUrl(normalizeUrl(url));
    }

    private static String normalizeUrl(String raw) {
        String u = raw.trim();
        if (!u.startsWith("http://") && !u.startsWith("https://")) {
            u = "https://" + u;
        }
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        return u;
    }

    private void askForUrl(String preset) {
        final EditText input = new EditText(this);
        input.setText(preset);
        input.setHint("https://…");
        input.setTextColor(Color.WHITE);
        input.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#E50914")));
        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        input.setPadding(pad, pad, pad, pad);

        FrameLayout container = new FrameLayout(this);
        container.addView(input, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        new AlertDialog.Builder(this)
                .setTitle("CineVerse")
                .setMessage("آدرس سرور CineVerse را وارد کنید\n(همان نشانی که در مرورگر باز می‌کنید)")
                .setView(container)
                .setCancelable(false)
                .setPositiveButton("اتصال", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        String url = normalizeUrl(input.getText().toString());
                        getSharedPreferences(PREFS, MODE_PRIVATE)
                                .edit().putString(KEY_URL, url).apply();
                        webView.loadUrl(url);
                    }
                })
                .setNegativeButton("خروج", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        finish();
                    }
                })
                .show();
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            webView.getWebChromeClient();
            if (fullscreenContainer != null) {
                rootLayout.removeView(fullscreenContainer);
                fullscreenContainer = null;
                customView = null;
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                if (customViewCallback != null) {
                    customViewCallback.onCustomViewHidden();
                    customViewCallback = null;
                }
            }
            return;
        }
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            rootLayout.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private class NativeBridge {
        @JavascriptInterface
        public String getAppUrl() {
            return getServerUrl();
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "1.0.0";
        }

        @JavascriptInterface
        public void openServerUrlDialog() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    askForUrl(getServerUrl());
                }
            });
        }

        @JavascriptInterface
        public void toast(final String message) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
