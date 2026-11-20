package mx.edu.itssmt.sgpi;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Actualización de la app fuera de Play Store: descarga el APK publicado, comprueba su SHA-256, que sea de
 * esta misma app y más nuevo, y abre el instalador de Android. Android exige que el usuario confirme la
 * instalación y sólo la acepta si el APK está firmado con la misma llave.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private volatile boolean downloading = false;

    @PluginMethod
    public void info(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionCode", versionCode(info));
            result.put("versionName", info.versionName);
            result.put("canInstall", canInstall());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("No se pudo leer la versión instalada.");
        }
    }

    /** Pantalla de Android para permitir que SGPI instale actualizaciones (Android 8+). */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(intent); } catch (ActivityNotFoundException ignored) { }
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256", "");
        if (url == null || !url.startsWith("https://") && !url.startsWith("http://")) {
            call.reject("Dirección de descarga no válida.");
            return;
        }
        if (downloading) {
            call.reject("Ya se está descargando la actualización.");
            return;
        }
        if (!canInstall()) {
            call.reject("Permite que SGPI instale actualizaciones.", "NEEDS_PERMISSION");
            return;
        }
        downloading = true;
        call.setKeepAlive(true);
        new Thread(() -> {
            File apk = new File(new File(getContext().getCacheDir(), "updates"), "sgpi-update.apk");
            try {
                File dir = apk.getParentFile();
                if (dir != null && !dir.exists() && !dir.mkdirs()) throw new IllegalStateException("No se pudo preparar la descarga.");
                String digest = download(url, apk);
                if (!sha256.isEmpty() && !sha256.equalsIgnoreCase(digest)) throw new SecurityException("El archivo descargado no coincide con la versión publicada.");

                // Debe ser esta misma app y una versión mayor a la instalada.
                PackageManager pm = getContext().getPackageManager();
                PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), 0);
                PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), 0);
                if (archive == null || !getContext().getPackageName().equals(archive.packageName)) throw new SecurityException("El archivo no es una versión de SGPI.");
                if (versionCode(archive) <= versionCode(installed)) throw new IllegalStateException("Ya tienes esta versión o una más reciente.");

                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                JSObject result = new JSObject();
                result.put("started", true);
                call.resolve(result);
            } catch (Exception e) {
                apk.delete();
                call.reject(e.getMessage() != null ? e.getMessage() : "No se pudo descargar la actualización.");
            } finally {
                downloading = false;
                call.setKeepAlive(false);
            }
        }).start();
    }

    private String download(String address, File target) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(60000);
        connection.setInstanceFollowRedirects(true);
        try {
            int status = connection.getResponseCode();
            if (status != 200) throw new IllegalStateException("El servidor respondió " + status + " al descargar la actualización.");
            long total = connection.getContentLengthLong();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(target)) {
                byte[] buffer = new byte[64 * 1024];
                long read = 0;
                int lastPercent = -1;
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                    digest.update(buffer, 0, count);
                    read += count;
                    int percent = total > 0 ? (int) (read * 100 / total) : -1;
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        progress.put("bytes", read);
                        notifyListeners("progress", progress);
                    }
                }
            }
            StringBuilder hex = new StringBuilder();
            for (byte b : digest.digest()) hex.append(String.format("%02x", b));
            return hex.toString();
        } finally {
            connection.disconnect();
        }
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    @SuppressWarnings("deprecation")
    private static long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }
}
