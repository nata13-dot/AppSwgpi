package mx.edu.itssmt.sgpi;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Widget «Pendiente principal»: un solo dato grande; se elige cuál al colocarlo o queda en automático. */
public class SgpiMainWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, id));
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetStore.forget(context, ids);
    }

    static RemoteViews render(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sgpi_widget_main);
        JSONObject data = WidgetStore.data(context);
        JSONArray items = WidgetStore.array(data, "items");
        String choice = WidgetStore.choice(context, widgetId);
        String wanted = "auto".equals(choice) && data != null ? data.optString("main", "") : choice;
        JSONObject item = null;
        for (int index = 0; index < items.length(); index++) {
            JSONObject candidate = items.optJSONObject(index);
            if (candidate != null && wanted.equals(candidate.optString("key"))) item = candidate;
        }
        if (item == null && items.length() > 0) item = items.optJSONObject(0);

        if (item == null) {
            views.setTextViewText(R.id.main_label, "SGPI");
            views.setTextViewText(R.id.main_value, "—");
            views.setTextViewText(R.id.main_detail, "Inicia sesión en la app");
            views.setOnClickPendingIntent(R.id.main_root, WidgetStore.open(context, "/dashboard", widgetId * 10));
            return views;
        }
        views.setTextViewText(R.id.main_label, "SGPI · " + item.optString("label"));
        views.setTextViewText(R.id.main_value, item.optString("value", "—"));
        views.setTextViewText(R.id.main_detail, item.optString("detail"));
        views.setOnClickPendingIntent(R.id.main_root, WidgetStore.open(context, item.optString("path", "/dashboard"), widgetId * 10));
        return views;
    }
}
