package mx.edu.itssmt.sgpi;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * El WebView de Android ignora los enlaces de descarga con blob:, así que la app web entrega aquí el archivo
 * en base64. Se guarda en Descargas/SGPI (Android 10+) o en la carpeta de descargas de la app, y se abre con
 * el visor que el teléfono tenga para ese tipo de archivo.
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "descarga");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String data = call.getString("data");
        if (data == null) {
            call.reject("No se recibió el contenido del archivo.");
            return;
        }

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri uri;
            String location;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SGPI");
                // Oculto hasta terminar de escribir: otras apps no ven un archivo a medias.
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Android no permitió crear el archivo.");
                try (OutputStream output = resolver.openOutputStream(uri)) {
                    if (output == null) throw new IllegalStateException("Android no permitió escribir el archivo.");
                    output.write(bytes);
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                location = "Descargas/SGPI";
            } else {
                File directory = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "SGPI");
                if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("No se pudo crear la carpeta de descargas.");
                File file = new File(directory, name);
                try (FileOutputStream output = new FileOutputStream(file)) {
                    output.write(bytes);
                }
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                location = file.getAbsolutePath();
            }

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("location", location);
            result.put("opened", open(uri, mimeType));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("No se pudo guardar el archivo: " + exception.getMessage(), exception);
        }
    }

    private boolean open(Uri uri, String mimeType) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, mimeType);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException exception) {
            // Sin visor para este tipo (por ejemplo .sql.gz): el archivo queda guardado igualmente.
            return false;
        }
    }
}
