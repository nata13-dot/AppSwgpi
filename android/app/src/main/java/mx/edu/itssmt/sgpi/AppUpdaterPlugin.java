package mx.edu.itssmt.sgpi;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;

/**
 * Actualización de la app fuera de Play Store SIN el permiso REQUEST_INSTALL_PACKAGES (Play Protect marca como
 * potencialmente dañinas las apps desconocidas que pueden instalar otras apps). El APK lo descarga el gestor de
 * descargas de Android; aquí se comprueba su SHA-256, que sea esta misma app y más nuevo. La instalación la abre el
 * propio sistema al tocar la notificación de descarga (o desde Descargas), que sí tiene ese permiso.
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
            call.resolve(result);
        } catch (Exception e) {
            call.reject("No se pudo leer la versión instalada.");
        }
    }

    /** Abre la lista de descargas del sistema: tocar el archivo de SGPI abre el instalador de Android. */
    @PluginMethod
    public void openDownloads(PluginCall call) {
        Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(intent); } catch (ActivityNotFoundException ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256", "");
        String version = call.getString("version", "nueva versión");
        if (url == null || !url.startsWith("https://") && !url.startsWith("http://")) {
            call.reject("Dirección de descarga no válida.");
            return;
        }
        if (downloading) {
            call.reject("Ya se está descargando la actualización.");
            return;
        }
        downloading = true;
        call.setKeepAlive(true);
        new Thread(() -> {
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            String name = "SGPI-" + version.replaceAll("[^0-9A-Za-z.\\-]", "") + "-" + System.currentTimeMillis() / 1000 + ".apk";
            File check = new File(new File(getContext().getCacheDir(), "updates"), "check.apk");
            long id = -1;
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("SGPI " + version)
                    .setDescription("Toca para instalar la actualización")
                    .setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                // Android 10+: carpeta pública Descargas/SGPI (sin permisos; también aparece en la app Descargas).
                // Antes: carpeta de la app (escribir en la pública pediría permiso de almacenamiento).
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "SGPI/" + name);
                else request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, name);
                id = manager.enqueue(request);
                waitFor(manager, id);

                // Debe ser el archivo publicado, de esta misma app y más nuevo que la instalada. Se lee por el gestor
                // de descargas (funciona con almacenamiento acotado) y se copia a caché sólo para revisarlo.
                File dir = check.getParentFile();
                if (dir != null && !dir.exists() && !dir.mkdirs()) throw new IllegalStateException("No se pudo revisar la descarga.");
                String hash = copyAndDigest(manager, id, check);
                if (!sha256.isEmpty() && !sha256.equalsIgnoreCase(hash)) throw new SecurityException("El archivo descargado no coincide con la versión publicada.");
                PackageManager pm = getContext().getPackageManager();
                PackageInfo archive = pm.getPackageArchiveInfo(check.getAbsolutePath(), 0);
                PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), 0);
                if (archive == null || !getContext().getPackageName().equals(archive.packageName)) throw new SecurityException("El archivo no es una versión de SGPI.");
                if (versionCode(archive) <= versionCode(installed)) throw new IllegalStateException("Ya tienes esta versión o una más reciente.");

                JSObject result = new JSObject();
                result.put("downloaded", true);
                call.resolve(result);
            } catch (Exception e) {
                if (id != -1) manager.remove(id);
                check.delete();
                call.reject(e.getMessage() != null ? e.getMessage() : "No se pudo descargar la actualización.");
            } finally {
                check.delete();
                downloading = false;
                call.setKeepAlive(false);
            }
        }).start();
    }

    /** Espera a que termine la descarga e informa el avance a la app. */
    private void waitFor(DownloadManager manager, long id) throws Exception {
        int lastPercent = -2;
        while (true) {
            try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
                if (cursor == null || !cursor.moveToFirst()) throw new IllegalStateException("Se canceló la descarga.");
                int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long done = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                int percent = total > 0 ? (int) (done * 100 / total) : -1;
                if (percent != lastPercent) {
                    lastPercent = percent;
                    JSObject progress = new JSObject();
                    progress.put("percent", percent);
                    progress.put("bytes", done);
                    notifyListeners("progress", progress);
                }
                if (status == DownloadManager.STATUS_SUCCESSFUL) return;
                if (status == DownloadManager.STATUS_FAILED) {
                    int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                    throw new IllegalStateException("No se pudo descargar la actualización (código " + reason + ").");
                }
            }
            Thread.sleep(400);
        }
    }

    private static String copyAndDigest(DownloadManager manager, long id, File copy) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (android.os.ParcelFileDescriptor fd = manager.openDownloadedFile(id);
             InputStream input = new FileInputStream(fd.getFileDescriptor());
             java.io.OutputStream output = new java.io.FileOutputStream(copy)) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) { digest.update(buffer, 0, count); output.write(buffer, 0, count); }
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    @SuppressWarnings("deprecation")
    private static long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }
}
