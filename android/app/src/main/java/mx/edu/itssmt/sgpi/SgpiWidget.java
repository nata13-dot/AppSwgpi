package mx.edu.itssmt.sgpi;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget de la pantalla de inicio. Muestra el último resumen que la app guardó (HomeWidgetPlugin): no consulta
 * la API por sí solo, así que no necesita guardar el token fuera de la app. Sólo lleva números y títulos.
 */
public class SgpiWidget extends AppWidgetProvider {
    static final String PREFS = "sgpi_widget";
    static final String EXTRA_PATH = "sgpi_path";
    private static final int[] TILES = {R.id.tile1, R.id.tile2, R.id.tile3, R.id.tile4};
    private static final int[] VALUES = {R.id.value1, R.id.value2, R.id.value3, R.id.value4};
    private static final int[] LABELS = {R.id.label1, R.id.label2, R.id.label3, R.id.label4};
    private static final int[] DETAILS = {R.id.detail1, R.id.detail2, R.id.detail3, R.id.detail4};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context));
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SgpiWidget.class));
        if (ids.length > 0) manager.updateAppWidget(ids, render(context));
    }

    private static RemoteViews render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sgpi_widget);
        views.setOnClickPendingIntent(R.id.widget_root, open(context, "/dashboard", 0));
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null);
        JSONObject data = null;
        try { data = raw == null ? null : new JSONObject(raw); } catch (Exception ignored) { /* se muestra vacío */ }
        JSONArray items = data == null ? null : data.optJSONArray("items");
        boolean empty = items == null || items.length() == 0;

        views.setViewVisibility(R.id.widget_empty, empty ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_grid, empty ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_subtitle, empty ? "Gestión de Proyectos Integradores" : subtitle(data));
        views.setTextViewText(R.id.widget_updated, empty ? "" : updated(data.optLong("saved_at", 0)));
        if (empty) return views;

        for (int index = 0; index < TILES.length; index++) {
            JSONObject item = index < items.length() ? items.optJSONObject(index) : null;
            // Con tres filas el cuarto cuadro queda vacío pero conserva la cuadrícula.
            views.setViewVisibility(TILES[index], item == null ? View.INVISIBLE : View.VISIBLE);
            if (item == null) continue;
            views.setTextViewText(VALUES[index], item.optString("value", "—"));
            views.setTextViewText(LABELS[index], item.optString("label", ""));
            views.setTextViewText(DETAILS[index], item.optString("detail", ""));
            views.setOnClickPendingIntent(TILES[index], open(context, item.optString("path", "/dashboard"), index + 1));
        }
        views.setViewVisibility(R.id.widget_row2, items.length() > 2 ? View.VISIBLE : View.GONE);
        return views;
    }

    private static String subtitle(JSONObject data) {
        String profile = data.optString("profile", "");
        String career = data.optString("career", "");
        return career.isEmpty() || "null".equals(career) ? profile : profile + " · " + career;
    }

    private static String updated(long savedAt) {
        if (savedAt <= 0) return "";
        return "Act. " + new SimpleDateFormat("HH:mm", new Locale("es", "MX")).format(new Date(savedAt));
    }

    /** Abre la app en la pantalla del cuadro; la app sólo acepta rutas internas. */
    private static PendingIntent open(Context context, String path, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.putExtra(EXTRA_PATH, path);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
