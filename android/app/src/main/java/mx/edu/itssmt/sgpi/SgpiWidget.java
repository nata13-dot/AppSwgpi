package mx.edu.itssmt.sgpi;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Widget «Pendientes»: hasta cuatro pendientes del perfil en cuadrícula. Sólo números y títulos. */
public class SgpiWidget extends AppWidgetProvider {
    private static final int[] TILES = {R.id.tile1, R.id.tile2, R.id.tile3, R.id.tile4};
    private static final int[] VALUES = {R.id.value1, R.id.value2, R.id.value3, R.id.value4};
    private static final int[] LABELS = {R.id.label1, R.id.label2, R.id.label3, R.id.label4};
    private static final int[] DETAILS = {R.id.detail1, R.id.detail2, R.id.detail3, R.id.detail4};
    private static final int[] CHIPS = {R.id.chip1, R.id.chip2, R.id.chip3, R.id.chip4};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, id));
    }

    private static RemoteViews render(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sgpi_widget);
        views.setOnClickPendingIntent(R.id.widget_root, WidgetStore.open(context, "/dashboard", widgetId * 10));
        JSONObject data = WidgetStore.data(context);
        JSONArray items = WidgetStore.array(data, "items");
        boolean empty = items.length() == 0;

        views.setViewVisibility(R.id.widget_empty, empty ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_grid, empty ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_subtitle, WidgetStore.subtitle(data));
        views.setTextViewText(R.id.widget_updated, empty ? "" : WidgetStore.updated(data));
        if (empty) return views;

        for (int index = 0; index < TILES.length; index++) {
            JSONObject item = index < items.length() ? items.optJSONObject(index) : null;
            // Con tres pendientes el cuarto cuadro queda vacío pero conserva la cuadrícula.
            views.setViewVisibility(TILES[index], item == null ? View.INVISIBLE : View.VISIBLE);
            if (item == null) continue;
            views.setTextViewText(VALUES[index], item.optString("value", "—"));
            views.setTextViewText(LABELS[index], item.optString("label", ""));
            views.setTextViewText(DETAILS[index], item.optString("detail", ""));
            WidgetStore.chip(views, CHIPS[index], item.optString("key"));
            views.setOnClickPendingIntent(TILES[index], WidgetStore.open(context, item.optString("path", "/dashboard"), widgetId * 10 + index + 1));
        }
        views.setViewVisibility(R.id.widget_row2, items.length() > 2 ? View.VISIBLE : View.GONE);
        return views;
    }
}
