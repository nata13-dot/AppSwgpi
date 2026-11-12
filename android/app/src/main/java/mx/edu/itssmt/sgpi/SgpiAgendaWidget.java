package mx.edu.itssmt.sgpi;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Widget «Próximas fechas»: entregas, presentaciones, cierres de ventanas y fin del periodo, en orden. */
public class SgpiAgendaWidget extends AppWidgetProvider {
    private static final int[] ROWS = {R.id.agenda_row1, R.id.agenda_row2, R.id.agenda_row3, R.id.agenda_row4, R.id.agenda_row5};
    private static final int[] DAYS = {R.id.agenda_day1, R.id.agenda_day2, R.id.agenda_day3, R.id.agenda_day4, R.id.agenda_day5};
    private static final int[] MONTHS = {R.id.agenda_month1, R.id.agenda_month2, R.id.agenda_month3, R.id.agenda_month4, R.id.agenda_month5};
    private static final int[] TITLES = {R.id.agenda_title1, R.id.agenda_title2, R.id.agenda_title3, R.id.agenda_title4, R.id.agenda_title5};
    private static final int[] DETAILS = {R.id.agenda_detail1, R.id.agenda_detail2, R.id.agenda_detail3, R.id.agenda_detail4, R.id.agenda_detail5};
    private static final int[] DATES = {R.id.agenda_date1, R.id.agenda_date2, R.id.agenda_date3, R.id.agenda_date4, R.id.agenda_date5};
    private static final int[] LEFT = {R.id.agenda_left1, R.id.agenda_left2, R.id.agenda_left3, R.id.agenda_left4, R.id.agenda_left5};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, id));
    }

    private static RemoteViews render(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sgpi_widget_agenda);
        JSONObject data = WidgetStore.data(context);
        views.setTextViewText(R.id.agenda_title_sub, WidgetStore.subtitle(data));
        views.setOnClickPendingIntent(R.id.agenda_root, WidgetStore.open(context, "/dashboard", widgetId * 10));
        JSONArray agenda = WidgetStore.array(data, "agenda");
        long now = System.currentTimeMillis();
        int shown = 0;
        for (int index = 0; index < agenda.length() && shown < ROWS.length; index++) {
            JSONObject event = agenda.optJSONObject(index);
            long at = event == null ? 0 : WidgetStore.time(event.optString("at"));
            // Lo que ya pasó desde la última actualización no se muestra.
            if (at <= now) continue;
            String[] day = WidgetStore.dayLabel(at).split(" ");
            views.setViewVisibility(ROWS[shown], View.VISIBLE);
            views.setTextViewText(DAYS[shown], day[0]);
            views.setTextViewText(MONTHS[shown], day.length > 1 ? day[1].toUpperCase(WidgetStore.ES) : "");
            views.setTextViewText(TITLES[shown], event.optString("title"));
            views.setTextViewText(DETAILS[shown], event.optString("detail") + " · " + WidgetStore.timeLabel(at));
            views.setInt(DATES[shown], "setBackgroundResource", WidgetStore.accent(event.optString("kind")));
            views.setTextViewText(LEFT[shown], WidgetStore.relative(at));
            views.setOnClickPendingIntent(ROWS[shown], WidgetStore.open(context, event.optString("path", "/dashboard"), widgetId * 10 + shown + 1));
            shown++;
        }
        for (int index = shown; index < ROWS.length; index++) views.setViewVisibility(ROWS[index], View.GONE);
        views.setViewVisibility(R.id.agenda_empty, shown == 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.agenda_empty, data == null ? "Inicia sesión en SGPI para ver tus fechas." : "Sin fechas próximas.");
        return views;
    }
}
