package mx.edu.itssmt.sgpi;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Lo que comparten los widgets: el último resumen que guardó la app, lo que cada widget eligió al colocarlo
 * y los atajos que abren la app en una pantalla. Ningún widget consulta la API por sí solo.
 */
final class WidgetStore {
    static final String PREFS = "sgpi_widget";
    static final String EXTRA_PATH = "sgpi_path";
    static final Locale ES = new Locale("es", "MX");
    /** Todos los tipos de widget: se redibujan juntos cuando llega un resumen nuevo. */
    static final Class<?>[] PROVIDERS = {SgpiWidget.class, SgpiMainWidget.class, SgpiAgendaWidget.class, SgpiShortcutsWidget.class, SgpiCountdownWidget.class};

    private WidgetStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject data(Context context) {
        String raw = prefs(context).getString("data", null);
        try { return raw == null ? null : new JSONObject(raw); } catch (Exception ignored) { return null; }
    }

    static JSONArray array(JSONObject data, String key) {
        JSONArray value = data == null ? null : data.optJSONArray(key);
        return value == null ? new JSONArray() : value;
    }

    /** Lo que eligió este widget al colocarlo; "auto" si no eligió nada. */
    static String choice(Context context, int widgetId) {
        return prefs(context).getString("choice_" + widgetId, "auto");
    }

    static void setChoice(Context context, int widgetId, String value) {
        prefs(context).edit().putString("choice_" + widgetId, value).apply();
    }

    static void forget(Context context, int[] widgetIds) {
        SharedPreferences.Editor editor = prefs(context).edit();
        for (int id : widgetIds) editor.remove("choice_" + id);
        editor.apply();
    }

    static void refreshAll(Context context) {
        for (Class<?> provider : PROVIDERS) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
            if (ids.length == 0) continue;
            Intent intent = new Intent(context, provider);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(intent);
        }
    }

    static String subtitle(JSONObject data) {
        if (data == null) return "Gestión de Proyectos Integradores";
        String profile = data.optString("profile", "");
        String career = data.optString("career", "");
        return career.isEmpty() || "null".equals(career) ? profile : profile + " · " + career;
    }

    static String updated(JSONObject data) {
        long savedAt = data == null ? 0 : data.optLong("saved_at", 0);
        return savedAt <= 0 ? "" : "Act. " + new SimpleDateFormat("HH:mm", ES).format(new Date(savedAt));
    }

    /** Fecha ISO de la API como milisegundos; 0 si no se entiende. */
    static long time(String iso) {
        try {
            return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(iso).getTime();
        } catch (Exception ignored) {
            return 0;
        }
    }

    static String dayLabel(long millis) {
        return new SimpleDateFormat("d MMM", ES).format(new Date(millis)).replace(".", "");
    }

    static String timeLabel(long millis) {
        return new SimpleDateFormat("HH:mm", ES).format(new Date(millis));
    }

    /** Abre la app en la pantalla indicada; la app sólo acepta rutas internas. */
    static PendingIntent open(Context context, String path, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.putExtra(EXTRA_PATH, path);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
