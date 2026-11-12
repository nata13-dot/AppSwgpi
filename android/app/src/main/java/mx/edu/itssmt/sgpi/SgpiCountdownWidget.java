package mx.edu.itssmt.sgpi;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget «Cuenta regresiva»: días y horas hasta la fecha elegida (o la más cercana). Android lo redibuja cada
 * 30 minutos, así que sigue bajando aunque la app no se abra; la fecha es la del último resumen guardado.
 */
public class SgpiCountdownWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, id));
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetStore.forget(context, ids);
    }

    private static RemoteViews render(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sgpi_widget_countdown);
        JSONObject data = WidgetStore.data(context);
        String kind = WidgetStore.choice(context, widgetId);
        JSONArray agenda = WidgetStore.array(data, "agenda");
        long now = System.currentTimeMillis();
        JSONObject event = null;
        long at = 0;
        for (int index = 0; index < agenda.length() && event == null; index++) {
            JSONObject candidate = agenda.optJSONObject(index);
            long time = candidate == null ? 0 : WidgetStore.time(candidate.optString("at"));
            if (time > now && ("auto".equals(kind) || kind.equals(candidate.optString("kind")))) { event = candidate; at = time; }
        }
        views.setOnClickPendingIntent(R.id.countdown_root, WidgetStore.open(context, event == null ? "/dashboard" : event.optString("path", "/dashboard"), widgetId * 10));
        if (event == null) {
            views.setInt(R.id.countdown_root, "setBackgroundResource", R.drawable.widget_background);
            views.setTextViewText(R.id.countdown_caption, "SGPI");
            views.setTextViewText(R.id.countdown_value, "—");
            views.setTextViewText(R.id.countdown_unit, "");
            views.setTextViewText(R.id.countdown_rest, "");
            views.setTextViewText(R.id.countdown_title, data == null ? "Inicia sesión en la app" : "Sin " + label(data, kind).toLowerCase(WidgetStore.ES) + " próxima");
            views.setTextViewText(R.id.countdown_detail, "");
            return views;
        }
        String[] parts = remaining(at - now);
        // El último día el fondo pasa a tonos cálidos para que se note la urgencia.
        views.setInt(R.id.countdown_root, "setBackgroundResource", at - now < 86400000L ? R.drawable.widget_background_urgent : R.drawable.widget_background);
        views.setTextViewText(R.id.countdown_caption, "FALTAN");
        views.setTextViewText(R.id.countdown_value, parts[0]);
        views.setTextViewText(R.id.countdown_unit, parts[1]);
        views.setTextViewText(R.id.countdown_rest, parts[2]);
        views.setTextViewText(R.id.countdown_title, event.optString("title"));
        views.setTextViewText(R.id.countdown_detail, WidgetStore.dayLabel(at) + " · " + WidgetStore.timeLabel(at));
        return views;
    }

    /** Número grande, su unidad y el resto: {"2", "días", "y 14 h"}. */
    static String[] remaining(long millis) {
        long minutes = Math.max(0, millis / 60000);
        long days = minutes / 1440;
        long hours = (minutes % 1440) / 60;
        if (days > 0) return new String[]{String.valueOf(days), days == 1 ? "día" : "días", hours > 0 ? "y " + hours + " h" : ""};
        if (hours > 0) return new String[]{String.valueOf(hours), hours == 1 ? "hora" : "horas", minutes % 60 > 0 ? "y " + (minutes % 60) + " min" : ""};
        return new String[]{String.valueOf(minutes), "min", ""};
    }

    private static String label(JSONObject data, String kind) {
        JSONArray options = WidgetStore.array(data, "countdown_options");
        for (int index = 0; index < options.length(); index++) {
            JSONObject option = options.optJSONObject(index);
            if (option != null && kind.equals(option.optString("key"))) return option.optString("label");
        }
        return "fecha";
    }
}
