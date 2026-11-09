package mx.edu.itssmt.sgpi;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Tono y vibración de las notificaciones de SGPI. Android fija el sonido de un canal al crearlo, así que cada
 * combinación de tono y vibración tiene su propio canal (sgpi_xxxx) y la API envía los avisos a ese canal.
 * El tono puede ser el predeterminado, uno de los del teléfono o un audio que la persona elija.
 */
@CapacitorPlugin(name = "NotificationTone")
public class NotificationTonePlugin extends Plugin {
    private static final String PREFS = "sgpi_notification_tone";
    private static final long[] PATTERN = {0, 350, 200, 350};
    private Ringtone playing;

    @PluginMethod
    public void getSettings(PluginCall call) {
        call.resolve(settings());
    }

    /** Crea (si falta) el canal con lo elegido y devuelve su id para registrarlo en la API. */
    @PluginMethod
    public void ensureChannel(PluginCall call) {
        applyChannel();
        call.resolve(settings());
    }

    @PluginMethod
    public void resetTone(PluginCall call) {
        prefs().edit().remove("uri").remove("title").putString("kind", "default").apply();
        applyChannel();
        call.resolve(settings());
    }

    @PluginMethod
    public void setVibrate(PluginCall call) {
        prefs().edit().putBoolean("vibrate", call.getBoolean("vibrate", true)).apply();
        applyChannel();
        call.resolve(settings());
    }

    @PluginMethod
    public void pickSystemTone(PluginCall call) {
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_NOTIFICATION);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Tono de las notificaciones de SGPI");
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, currentUri());
        startActivityForResult(call, intent, "systemTonePicked");
    }

    @ActivityCallback
    private void systemTonePicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(settings());
            return;
        }
        Uri uri = result.getData().getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        if (uri == null || Settings.System.DEFAULT_NOTIFICATION_URI.equals(uri)) {
            prefs().edit().remove("uri").remove("title").putString("kind", "default").apply();
        } else {
            prefs().edit().putString("uri", uri.toString()).putString("title", toneTitle(uri)).putString("kind", "system").apply();
        }
        applyChannel();
        call.resolve(settings());
    }

    @PluginMethod
    public void pickCustomTone(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        startActivityForResult(call, intent, "customTonePicked");
    }

    @ActivityCallback
    private void customTonePicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(settings());
            return;
        }
        try {
            Uri source = result.getData().getData();
            String name = displayName(source);
            Uri stored = storeTone(source, name);
            prefs().edit().putString("uri", stored.toString()).putString("title", name.replaceFirst("\\.[^.]+$", "")).putString("kind", "custom").apply();
            applyChannel();
            call.resolve(settings());
        } catch (Exception exception) {
            call.reject("No se pudo usar ese audio: " + exception.getMessage(), exception);
        }
    }

    /** Suena y vibra como lo hará una notificación; también se usa cuando llega un aviso con la app abierta. */
    @PluginMethod
    public void preview(PluginCall call) {
        if (playing != null && playing.isPlaying()) playing.stop();
        playing = RingtoneManager.getRingtone(getContext(), soundUri());
        if (playing != null) playing.play();
        if (prefs().getBoolean("vibrate", true)) vibrate();
        call.resolve();
    }

    private void vibrate() {
        Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createWaveform(PATTERN, -1));
        else vibrator.vibrate(PATTERN, -1);
    }

    private void applyChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        String id = channelId();
        if (manager.getNotificationChannel(id) == null) {
            NotificationChannel channel = new NotificationChannel(id, "Avisos de SGPI", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Avisos académicos y de tus proyectos");
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            channel.setSound(soundUri(), new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            boolean vibrate = prefs().getBoolean("vibrate", true);
            channel.enableVibration(vibrate);
            if (vibrate) channel.setVibrationPattern(PATTERN);
            channel.enableLights(true);
            manager.createNotificationChannel(channel);
        }
        // Los canales anteriores de SGPI sobran: así la persona ve uno solo en los ajustes del teléfono.
        for (NotificationChannel channel : manager.getNotificationChannels()) {
            if (channel.getId().startsWith("sgpi") && !channel.getId().equals(id)) manager.deleteNotificationChannel(channel.getId());
        }
    }

    private String channelId() {
        String key = (prefs().getString("uri", "default")) + "|" + prefs().getBoolean("vibrate", true);
        return "sgpi_" + Integer.toHexString(key.hashCode());
    }

    private Uri currentUri() {
        String uri = prefs().getString("uri", null);
        return uri == null ? Settings.System.DEFAULT_NOTIFICATION_URI : Uri.parse(uri);
    }

    private Uri soundUri() {
        return currentUri();
    }

    /** Copia el audio donde el sistema pueda leerlo al sonar la notificación. */
    private Uri storeTone(Uri source, String name) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        String mime = resolver.getType(source);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Audio.Media.DISPLAY_NAME, name);
            values.put(MediaStore.Audio.Media.MIME_TYPE, mime == null ? "audio/mpeg" : mime);
            values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_NOTIFICATIONS + "/SGPI");
            values.put(MediaStore.Audio.Media.IS_NOTIFICATION, 1);
            values.put(MediaStore.Audio.Media.IS_PENDING, 1);
            Uri target = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values);
            if (target == null) throw new IllegalStateException("Android no permitió guardar el tono.");
            copy(resolver, source, resolver.openOutputStream(target));
            values.clear();
            values.put(MediaStore.Audio.Media.IS_PENDING, 0);
            resolver.update(target, values, null, null);
            return target;
        }
        File directory = new File(getContext().getFilesDir(), "tones");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("No se pudo crear la carpeta de tonos.");
        File file = new File(directory, System.currentTimeMillis() + "-" + name.replaceAll("[^A-Za-z0-9._-]", "_"));
        copy(resolver, source, new FileOutputStream(file));
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        getContext().grantUriPermission("com.android.systemui", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return uri;
    }

    private void copy(ContentResolver resolver, Uri source, OutputStream output) throws Exception {
        if (output == null) throw new IllegalStateException("Android no permitió escribir el tono.");
        try (InputStream input = resolver.openInputStream(source); OutputStream out = output) {
            if (input == null) throw new IllegalStateException("No se pudo leer el audio.");
            byte[] buffer = new byte[16384];
            int read;
            long total = 0;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                // Un tono largo no tiene sentido como aviso y ocuparía espacio.
                if (total > 5 * 1024 * 1024) throw new IllegalStateException("el audio pesa más de 5 MB.");
                out.write(buffer, 0, read);
            }
        }
    }

    private String displayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) {
            // Sin nombre se usa uno genérico.
        }
        return "Tono personalizado";
    }

    private String toneTitle(Uri uri) {
        Ringtone ringtone = RingtoneManager.getRingtone(getContext(), uri);
        return ringtone == null ? "Tono del teléfono" : ringtone.getTitle(getContext());
    }

    private JSObject settings() {
        JSObject result = new JSObject();
        String kind = prefs().getString("kind", "default");
        result.put("kind", kind);
        result.put("title", "default".equals(kind) ? "Predeterminado del teléfono" : prefs().getString("title", "Tono"));
        result.put("vibrate", prefs().getBoolean("vibrate", true));
        result.put("channelId", channelId());
        return result;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
