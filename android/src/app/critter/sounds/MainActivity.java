package app.critter.sounds;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

/**
 * Critter Sounds for Android: the web version at sounds.crittervtt.com, full screen, so it opens like an app from the
 * home screen. Everything is the live site, so Critter Sounds' updates arrive without a new app; the app itself
 * updates from the Critter Sounds releases on GitHub (Updater). Sounds you add stay on the phone, in the app's storage.
 */
public class MainActivity extends Activity {
    static final String HOST = "sounds.crittervtt.com";
    static final String HOME = "https://" + HOST + "/";
    static final int TONE = Color.rgb(11, 10, 18);   // Critter Sounds' dark tone (#0b0a12)
    static final int PICK = 41;

    WebView web;
    ValueCallback<Uri[]> picked;
    Updater updater;
    boolean shown;   // the page has drawn: the launch screen can go
    long backAt;

    static boolean ours(Uri u) { return u != null && HOST.equals(u.getHost()); }

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        // the music keeps going while you run the table: the screen stays on, as in Critter VTT
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(TONE);
        getWindow().setNavigationBarColor(TONE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(TONE);
        web = new WebView(this);
        web.setBackgroundColor(TONE);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        final View content = findViewById(android.R.id.content);
        content.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
            @Override public boolean onPreDraw() { if (!shown) return false; content.getViewTreeObserver().removeOnPreDrawListener(this); return true; }
        });
        root.postDelayed(this::pageShown, 4000);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // pads, previews and the music start at a tap
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        // the phone's font size (Settings › Display), up to 130% so the panels still hold their text
        s.setTextZoom(Math.max(100, Math.min(130, Math.round(getResources().getConfiguration().fontScale * 100))));
        s.setUserAgentString(s.getUserAgentString() + " CritterSoundsAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageCommitVisible(WebView view, String url) { pageShown(); }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (ours(req.getUrl())) return false;   // the app stays here
                open(req.getUrl());                     // everything else (GitHub, credits, Tabletop Audio) in the browser
                return true;
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) { if (req.isForMainFrame()) offline(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // adding sounds from the phone (Playlists › Add files, Sound pads › Sounds)
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (picked != null) picked.onReceiveValue(null);
                picked = cb;
                try { startActivityForResult(params.createIntent(), PICK); }
                catch (ActivityNotFoundException e) { picked = null; return false; }
                return true;
            }
        });

        backGesture();
        if (saved != null) web.restoreState(saved);
        else web.loadUrl(startUrl(getIntent()));
        updater = new Updater(this);
    }

    void pageShown() { if (!shown) { shown = true; findViewById(android.R.id.content).invalidate(); } }

    @Override
    protected void onResume() {
        super.onResume();
        if (updater != null) updater.check(false);   // a newer version of the app on GitHub? (every hour at most)
    }

    String startUrl(Intent in) { Uri u = in == null ? null : in.getData(); return ours(u) ? u.toString() : HOME; }

    @Override
    protected void onNewIntent(Intent in) {
        super.onNewIntent(in);
        if (in != null && ours(in.getData())) web.loadUrl(startUrl(in));
    }

    void open(Uri u) { try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { } }

    void offline() {
        String html = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
            + "<body style='margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0a12;color:#eee;font:16px system-ui,sans-serif;text-align:center'>"
            + "<div style='padding:24px'><h1 style='font-size:22px'>Can't reach Critter Sounds</h1>"
            + "<p style='color:#bbb;line-height:1.5'>The app opens sounds.crittervtt.com, which needs the internet the first time. Check your connection and try again.</p>"
            + "<a href='" + HOME + "' style='display:inline-block;margin-top:12px;padding:12px 22px;border-radius:10px;background:#8800ff;color:#fff;font-weight:700;text-decoration:none'>Try again</a></div></body>";
        web.loadDataWithBaseURL(HOME, html, "text/html", "utf-8", null);
    }

    // back (the swipe from the edge, or the back button) goes back a step in the app: it closes the player, a menu or
    // a screen it opened (the page keeps each in the browser history). With nothing left, a first swipe only says so;
    // a second one within two seconds sends Critter Sounds to the background (it keeps playing)
    void backGesture() {
        if (Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { goBack(); }

    void goBack() {
        if (web.canGoBack()) { backAt = 0; web.goBack(); return; }
        long now = System.currentTimeMillis();
        if (now - backAt < 2000) { backAt = 0; moveTaskToBack(true); return; }
        backAt = now;
        Toast.makeText(this, "Swipe back again to leave Critter Sounds", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK && picked != null) { picked.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); picked = null; return; }
        super.onActivityResult(req, res, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    protected void onDestroy() {
        if (updater != null) updater.stop();
        if (web != null) { web.stopLoading(); ((ViewGroup) web.getParent()).removeView(web); web.destroy(); }
        super.onDestroy();
    }
}
