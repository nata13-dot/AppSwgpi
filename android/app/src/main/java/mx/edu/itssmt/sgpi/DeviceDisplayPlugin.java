package mx.edu.itssmt.sgpi;

import android.content.res.Configuration;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tamaño de letra y modo oscuro del teléfono. La app escala toda la interfaz con ese dato; el zoom de texto del
 * WebView queda fijo para no aplicar la escala dos veces.
 */
@CapacitorPlugin(name = "DeviceDisplay")
public class DeviceDisplayPlugin extends Plugin {

    @Override
    public void load() {
        getBridge().getWebView().getSettings().setTextZoom(100);
    }

    @PluginMethod
    public void get(PluginCall call) {
        Configuration configuration = getContext().getResources().getConfiguration();
        JSObject result = new JSObject();
        result.put("fontScale", configuration.fontScale);
        result.put("dark", (configuration.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        call.resolve(result);
    }
}
