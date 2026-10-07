package app.critter.sounds;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.ProgressBar;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Keeps Critter Sounds for Android up to date. Every Critter Sounds release on GitHub carries critter-sounds-android.json
 * ({"versionCode": 3, "versionName": "1.2.0"}) next to Critter-Sounds.apk. At most every few hours the app reads
 * it; when it's newer, the app asks, downloads the APK straight into Android's installer and Android asks to confirm.
 * Android only accepts an update signed with the same key, so nothing else can be slipped in.
 */
class Updater {
    static final String BASE = "https://github.com/booskers/critter-sounds/releases/latest/download/";
    static final String INFO = BASE + "critter-sounds-android.json", APK = BASE + "Critter-Sounds.apk";
    static final String DONE = "app.critter.sounds.INSTALLED";
    static final long EVERY = 60 * 60 * 1000L;   // on its own: every hour at most (and "Check for updates" any time)

    final Activity a;
    final SharedPreferences prefs;
    boolean busy;
    String waitingFor;   // an update the person said yes to, waiting for "Install unknown apps" to be allowed

    Updater(Activity a) {
        this.a = a;
        prefs = a.getSharedPreferences("updates", Context.MODE_PRIVATE);
    }

    @SuppressWarnings("deprecation")
    long myVersion() {
        try {
            android.content.pm.PackageInfo p = a.getPackageManager().getPackageInfo(a.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
        } catch (Exception e) { return Long.MAX_VALUE; }
    }

    String myName() {
        try { return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }

    void say(String t) { a.runOnUiThread(() -> Toast.makeText(a, t, Toast.LENGTH_LONG).show()); }

    /** on start and on coming back: look for a newer version quietly, every hour at most. By hand ("Check for updates"):
     *  right away, a version skipped before is offered again, and it says how it went */
    void check(boolean byHand) {
        if (waitingFor != null) { String v = waitingFor; waitingFor = null; if (canInstall()) download(v); return; }
        long last = prefs.getLong("checked", 0);
        if (busy) { if (byHand) say("Already checking for updates…"); return; }
        if (!byHand && System.currentTimeMillis() - last < EVERY) return;
        busy = true;
        if (byHand) say("Checking for updates…");
        new Thread(() -> {
            try {
                JSONObject j = new JSONObject(new String(fetch(INFO + "?t=" + System.currentTimeMillis()), "UTF-8"));
                long code = j.getLong("versionCode"); String name = j.optString("versionName", "");
                prefs.edit().putLong("checked", System.currentTimeMillis()).apply();
                if (code > myVersion() && (byHand || code != prefs.getLong("skipped", -1))) a.runOnUiThread(() -> offer(code, name));
                else if (byHand) say("Critter Sounds for Android " + myName() + " is up to date.");
            } catch (Exception e) {   // offline, or GitHub unreachable: quietly try again next time
                if (byHand) say("Couldn't check for updates. Check your connection and try again.");
            } finally { busy = false; }
        }).start();
    }

    void offer(long code, String name) {
        if (a.isFinishing()) return;
        new AlertDialog.Builder(a)
            .setTitle("Critter Sounds " + name + " is ready")
            .setMessage("A new version of the app is out. Update now? It takes a moment, and your sounds and playlists stay as they are.")
            .setPositiveButton("Update", (d, w) -> { if (canInstall()) download(name); else askToAllow(name); })
            .setNegativeButton("Later", null)
            .setNeutralButton("Skip this one", (d, w) -> prefs.edit().putLong("skipped", code).apply())
            .show();
    }

    boolean canInstall() { return a.getPackageManager().canRequestPackageInstalls(); }

    // Android asks once whether Critter Sounds may install updates (Settings › Install unknown apps)
    void askToAllow(String name) {
        new AlertDialog.Builder(a)
            .setTitle("Allow updates")
            .setMessage("Android needs your OK for Critter Sounds to install its own updates. On the next screen, switch on \"Allow from this source\", then come back.")
            .setPositiveButton("Continue", (d, w) -> {
                waitingFor = name;
                a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName())));
            })
            .setNegativeButton("Not now", null)
            .show();
    }

    void download(String name) {
        ProgressBar bar = new ProgressBar(a, null, android.R.attr.progressBarStyleHorizontal);
        bar.setIndeterminate(true);
        int pad = (int) (24 * a.getResources().getDisplayMetrics().density);
        bar.setPadding(pad, pad / 2, pad, 0);
        AlertDialog dlg = new AlertDialog.Builder(a).setTitle("Downloading Critter Sounds " + name).setView(bar).setCancelable(false).show();
        new Thread(() -> {
            PackageInstaller pi = a.getPackageManager().getPackageInstaller();
            int id = -1;
            try {
                HttpURLConnection c = open(APK);
                long total = c.getContentLengthLong();
                PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                sp.setAppPackageName(a.getPackageName());
                if (total > 0) { sp.setSize(total); a.runOnUiThread(() -> { bar.setIndeterminate(false); bar.setMax(1000); }); }
                id = pi.createSession(sp);
                try (PackageInstaller.Session s = pi.openSession(id)) {
                    try (InputStream in = c.getInputStream(); OutputStream out = s.openWrite("critter.apk", 0, total)) {
                        byte[] buf = new byte[64 * 1024]; long got = 0; int n;
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n); got += n;
                            if (total > 0) { final int p = (int) (got * 1000 / total); a.runOnUiThread(() -> bar.setProgress(p)); }
                        }
                        s.fsync(out);
                    }
                    listen();
                    Intent done = new Intent(DONE).setPackage(a.getPackageName());
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    s.commit(PendingIntent.getBroadcast(a, 41, done, flags).getIntentSender());
                }
                a.runOnUiThread(dlg::dismiss);
            } catch (Exception e) {
                if (id >= 0) try { pi.abandonSession(id); } catch (Exception ignored) { }
                a.runOnUiThread(() -> { dlg.dismiss(); Toast.makeText(a, "The update didn't download. Check your connection and try again later.", Toast.LENGTH_LONG).show(); });
            }
        }).start();
    }

    BroadcastReceiver receiver;
    // what the installer says: it needs the person's OK (show Android's screen), it worked, or it failed
    void listen() {
        if (receiver != null) return;
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent in) {
                int st = in.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
                if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                    Intent confirm = in.getParcelableExtra(Intent.EXTRA_INTENT);
                    if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); a.startActivity(confirm); }
                } else if (st != PackageInstaller.STATUS_SUCCESS && st != PackageInstaller.STATUS_FAILURE_ABORTED) {
                    Toast.makeText(a, "The update couldn't be installed. You can download it from the Critter Sounds website.", Toast.LENGTH_LONG).show();
                }
            }
        };
        IntentFilter f = new IntentFilter(DONE);
        if (Build.VERSION.SDK_INT >= 33) a.registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED);
        else a.registerReceiver(receiver, f);
    }

    void stop() { if (receiver != null) { try { a.unregisterReceiver(receiver); } catch (Exception ignored) { } receiver = null; } }

    static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(30000);
        c.setInstanceFollowRedirects(true);   // GitHub sends release files on to its download host (https to https)
        c.setRequestProperty("User-Agent", "CritterSounds");
        c.setUseCaches(false);   // always the release's current file, never a copy kept from before
        c.setRequestProperty("Cache-Control", "no-cache");
        if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
        return c;
    }

    static byte[] fetch(String url) throws Exception {
        HttpURLConnection c = open(url);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0 && b.size() < 64 * 1024) b.write(buf, 0, n);
            return b.toByteArray();
        }
    }
}
