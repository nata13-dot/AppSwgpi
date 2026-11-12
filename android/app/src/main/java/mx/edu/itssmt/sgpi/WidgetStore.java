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

    /** Ícono de un pendiente o acceso según su clave (las mismas de WidgetController). */
    static int icon(String key) {
        switch (key) {
            case "deliverable": case "deliverables": case "review": return R.drawable.ic_widget_task;
            case "project": case "projects": case "advised": case "career": return R.drawable.ic_widget_folder;
            case "proposals": return R.drawable.ic_widget_idea;
            case "grades": case "evaluations": return R.drawable.ic_widget_star;
            case "presentation": case "rooms": case "period": return R.drawable.ic_widget_event;
            case "requests": return R.drawable.ic_widget_person_add;
            case "users": case "profile": return R.drawable.ic_widget_person;
            case "repository": return R.drawable.ic_widget_library;
            case "alerts": return R.drawable.ic_widget_warning;
            default: return R.drawable.ic_widget_bolt;
        }
    }

    /** Color de acento de un pendiente, acceso o tipo de evento de la agenda. */
    static int accent(String key) {
        switch (key) {
            case "deliverable": case "deliverables": case "review": return R.drawable.widget_accent_amber;
            case "proposals": case "presentation": case "requests": return R.drawable.widget_accent_violet;
            case "grades": case "evaluations": case "room": case "rooms": case "repository": return R.drawable.widget_accent_teal;
            case "alerts": case "period_end": return R.drawable.widget_accent_rose;
            default: return R.drawable.widget_accent_cyan;
        }
    }

    static void chip(android.widget.RemoteViews views, int viewId, String key) {
        views.setImageViewResource(viewId, icon(key));
        views.setInt(viewId, "setBackgroundResource", accent(key));
    }

    /** "Hoy", "Mañana" o "En 5 d" para la etiqueta de la agenda. */
    static String relative(long millis) {
        java.util.Calendar today = java.util.Calendar.getInstance();
        java.util.Calendar day = java.util.Calendar.getInstance();
        day.setTimeInMillis(millis);
        for (java.util.Calendar calendar : new java.util.Calendar[]{today, day}) {
            calendar.set(java.util.Calendar.HOUR_OF_DAY, 0);
            calendar.set(java.util.Calendar.MINUTE, 0);
            calendar.set(java.util.Calendar.SECOND, 0);
            calendar.set(java.util.Calendar.MILLISECOND, 0);
        }
        long days = Math.round((day.getTimeInMillis() - today.getTimeInMillis()) / 86400000.0);
        return days <= 0 ? "Hoy" : days == 1 ? "Mañana" : "En " + days + " d";
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
