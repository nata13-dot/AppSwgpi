package mx.edu.itssmt.sgpi;

import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * Puente entre la app y el widget: la app guarda aquí el resumen de /widget y el widget avisa qué cuadro se tocó.
 * Al cerrar sesión se borra, para que el siguiente usuario del teléfono no vea pendientes ajenos.
 */
@CapacitorPlugin(name = "HomeWidget")
public class HomeWidgetPlugin extends Plugin {
    private String pendingPath;

    @Override
    public void load() {
        pendingPath = takePath(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String path = takePath(intent);
        if (path == null) return;
        JSObject event = new JSObject();
        event.put("path", path);
        notifyListeners("open", event, true);
    }

    @PluginMethod
    public void update(PluginCall call) {
        JSObject data = call.getObject("data");
        if (data == null) {
            call.reject("Faltan los datos del widget.");
            return;
        }
        try {
            JSONObject stored = new JSONObject(data.toString());
            stored.put("saved_at", System.currentTimeMillis());
            prefs().edit().putString("data", stored.toString()).apply();
            SgpiWidget.refreshAll(getContext());
            call.resolve();
        } catch (Exception exception) {
            call.reject("No se pudo actualizar el widget.", exception);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        prefs().edit().remove("data").apply();
        SgpiWidget.refreshAll(getContext());
        call.resolve();
    }

    /** La pantalla que se pidió desde el widget al abrir la app en frío; se entrega una sola vez. */
    @PluginMethod
    public void takeLaunchPath(PluginCall call) {
        JSObject result = new JSObject();
        result.put("path", pendingPath);
        pendingPath = null;
        call.resolve(result);
    }

    private String takePath(Intent intent) {
        if (intent == null || !intent.hasExtra(SgpiWidget.EXTRA_PATH)) return null;
        String path = intent.getStringExtra(SgpiWidget.EXTRA_PATH);
        intent.removeExtra(SgpiWidget.EXTRA_PATH);
        return path;
    }

    private android.content.SharedPreferences prefs() {
        return getContext().getSharedPreferences(SgpiWidget.PREFS, Context.MODE_PRIVATE);
    }
}
